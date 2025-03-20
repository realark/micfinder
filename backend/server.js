require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const sanitizeHtml = require('sanitize-html');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT;
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  ssl: process.env.PG_SSL === 'true',
});
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({
  origin: process.env.CORS_DISABLE === 'true'
      ? true
      : [
        'https://micfinder.org',
        'https://www.micfinder.org',
        'https://boise.micfinder.org',
        'https://micfinder-frontend.onrender.com',
        'https://micfinder-backend.onrender.com'
      ],
  credentials: true
}));
app.use(express.json());


const specs = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'micfinder API',
      version: '0.0.1'
    },
    servers: [
      {
        url: process.env.VITE_MICFINDER_API_URL
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /auth/login endpoint'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./server.js']
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check API health status
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 */
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, password_hash, password_reset_required FROM app_user WHERE email = $1 AND NOT account_disabled',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      status: 'ok',
      token,
      userId: user.id,
      passwordResetRequired: user.password_reset_required || false
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 description: The new password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       400:
 *         description: Invalid request - missing or invalid password
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 */
app.post('/auth/change-password', async (req, res) => {
  const { newPassword } = req.body;

  // Validate the new password
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database and clear the password_reset_required flag
    const result = await pool.query(
      'UPDATE app_user SET password_hash = $1, password_reset_required = false WHERE id = $2 RETURNING id',
      [passwordHash, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ status: 'ok' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

const validateMicData = (req, res, next) => {
  const required = [
    'name',
    'location',
    'startDate',
    'showTime'
  ];
  const allFields = [
    ...required,
    'id',           // all mics have an ID, but on create it will be undefined
    'contactInfo',
    'recurrence',
    'signupInstructions'
  ];
  const missing = required.filter(field => !req.body[field]);

  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(', ')}`
    });
  }
  const unknown = Object.keys(req.body).filter(field => !allFields.includes(field));
  if (unknown.length > 0) {
    return res.status(400).json({
      error: `Unknown fields not allowed: ${unknown.join(', ')}`
    });
  }
  allFields.forEach(field => {
    if (req.body[field]) {
      req.body[field] = sanitizeHtml(req.body[field], {
        allowedTags: [],          // Allow no HTML tags
        allowedAttributes: {},     // Allow no HTML attributes
        disallowedTagsMode: 'discard'
      });
    }
  });
  next();
};

/**
 * @openapi
 * /mics:
 *   get:
 *     summary: Get all open mics within a date range
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *         description: Start date, inclusive
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *         description: End date, inclusive
 *     responses:
 *       200:
 *         description: List of open mics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mics:
 *                   type: array
 */
app.get('/mics', async (req, res) => {
  const { start, end } = req.query;

  try {
    let query = 'SELECT id, data FROM mic';
    const queryParams = [];

    // Add date filtering if start and end dates are provided
    if (start && end) {
      query += ' WHERE (data->>\'startDate\')::date >= $1 AND (data->>\'startDate\')::date <= $2';
      queryParams.push(start, end);
    } else if (start) {
      query += ' WHERE (data->>\'startDate\')::date >= $1';
      queryParams.push(start);
    } else if (end) {
      query += ' WHERE (data->>\'startDate\')::date <= $1';
      queryParams.push(end);
    }

    // Order by start date
    query += ' ORDER BY (data->>\'startDate\')::date ASC';

    const result = await pool.query(query, queryParams);

    // Map the results to match the expected format
    const mics = result.rows.map(row => ({
      ...row.data,
      id: row.id
    }));

    return res.json({ mics: mics });
  } catch (error) {
    console.error('Error fetching open mics data:', error);
    res.status(500).json({ error: 'Failed to load open mics data' });
  }
});

/**
 * @openapi
 * /mics:
 *   post:
 *     summary: Create a new open mic
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - startDate
 *             properties:
 *               name:
 *                 type: string
 *               contactInfo:
 *                 type: string
 *               location:
 *                 type: string
 *               recurrence:
 *                 type: string
 *               signupInstructions:
 *                 type: string
 *               showTime:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Open mic created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 mic:
 *                   type: object
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 */
app.post('/mics', validateMicData, async (req, res) => {
  const micData = req.body;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Insert the new mic into the database
    // The trigger will handle setting the ID in the JSONB data
    const result = await pool.query(
      'INSERT INTO mic (data, last_edited_by) VALUES ($1, $2) RETURNING id, data',
      [micData, userId]
    );

    // Return the data from the database which now has the ID set by the trigger
    res.json({
      status: 'ok',
      mic: {
        ...result.rows[0].data,
        id: result.rows[0].id
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Error creating open mic:', error);
    res.status(500).json({ error: 'Failed to create open mic' });
  }
});

/**
 * @openapi
 * /mics/{id}:
 *   get:
 *     summary: Get a specific open mic by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The open mic ID
 *     responses:
 *       200:
 *         description: Open mic details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 mic:
 *                   type: object
 *       404:
 *         description: Open mic not found
 */
app.get('/mics/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT id, data FROM mic WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Open mic not found' });
    }

    const mic = {
      ...result.rows[0].data,
      id: result.rows[0].id
    };

    res.json({ status: 'ok', mic });
  } catch (error) {
    console.error('Error fetching open mic:', error);
    res.status(500).json({ error: 'Failed to fetch open mic' });
  }
});

/**
 * @openapi
 * /mics/{id}:
 *   put:
 *     summary: Update an existing open mic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The open mic ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               contactInfo:
 *                 type: string
 *               location:
 *                 type: string
 *               recurrence:
 *                 type: string
 *               signupInstructions:
 *                 type: string
 *               showTime:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Open mic updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 mic:
 *                   type: object
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       404:
 *         description: Open mic not found
 */
app.put('/mics/:id', validateMicData, async (req, res) => {
  const { id } = req.params;
  const micData = req.body;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // FIXME: require user to pass fresh edit version instead of fetching (defeats the purpose)
    const currentMic = await pool.query(
      'SELECT edit_version FROM mic WHERE id = $1',
      [id]
    );

    if (currentMic.rows.length === 0) {
      return res.status(404).json({ error: 'Open mic not found' });
    }

    const editVersion = currentMic.rows[0].edit_version;

    const result = await pool.query(
      'UPDATE mic SET data = $1, edit_version = $2, last_edited_by = $3 WHERE id = $4 RETURNING id, data',
      [{ ...micData, id }, editVersion, userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Open mic not found' });
    }

    res.json({
      status: 'ok',
      mic: {
        ...result.rows[0].data,
        id: result.rows[0].id
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Error updating open mic:', error);
    res.status(500).json({ error: 'Failed to update open mic' });
  }
});

/**
 * @openapi
 * /mics/{id}:
 *   delete:
 *     summary: Delete an open mic
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The open mic ID
 *     responses:
 *       200:
 *         description: Open mic deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 id:
 *                   type: string
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *       404:
 *         description: Open mic not found
 */
app.delete('/mics/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // FIXME: require fresh edit_version
    const client = await pool.connect();
    var result = null;
    try {
      await client.query('BEGIN');
      // NOTE: we can't use a param to set app.user_id, but userId comes from the JWT so it's safe from injections
      await client.query(`SET LOCAL app.user_id = '${userId}'`);
      result = await client.query('DELETE FROM mic WHERE id = $1 RETURNING id', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (result == null || result.rows.length === 0) {
      return res.status(404).json({ error: 'Open mic not found' });
    }

    res.json({ status: 'ok', id });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Error deleting open mic:', error);
    res.status(500).json({ error: 'Failed to delete open mic' });
  }
});

// everyting else
app.use((req, res) => {
  res.status(404).json({ error: 'resource not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'internal server error' });
});

function shutdown() {
  return pool.end();
}

module.exports = { app, shutdown };

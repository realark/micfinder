const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const specs = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Open Mics API',
      version: '0.0.1'
    },
    servers: [
      {
        url: `http://localhost:${port}`
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
 *               - username
 *               - password
 *             properties:
 *               username:
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
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  // TODO: Add real auth later
  res.json({ status: 'ok' });
});

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
 *         description: Start date
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *         description: End date
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
app.get('/mics', (req, res) => {
  const { start, end } = req.query;
  // Load the open mics data from the JSON file
  const fs = require('fs');
  const path = require('path');

  try {
    const openMicsData = fs.readFileSync(path.join(__dirname, 'openMics.json'), 'utf8');
    const mics = JSON.parse(openMicsData);
    res.json({
      mics,
      start,
      end
    });
  } catch (error) {
    console.error('Error reading open mics data:', error);
    res.status(500).json({ error: 'Failed to load open mics data' });
  }
});


/**
 * @openapi
 * /mics:
 *   post:
 *     summary: Create a new open mic
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
 */
app.post('/mics', (req, res) => {
  const micData = req.body;
  // TODO: Add database insert
  res.json({ status: 'ok', mic: micData });
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
app.get('/mics/:id', (req, res) => {
  const { id } = req.params;
  // TODO: Add database query
  res.json({ status: 'ok', mic: { id } });
});

/**
 * @openapi
 * /mics/{id}:
 *   put:
 *     summary: Update an existing open mic
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
 *       404:
 *         description: Open mic not found
 */
app.put('/mics/:id', (req, res) => {
  const { id } = req.params;
  const micData = req.body;
  // TODO: Add database update
  res.json({ status: 'ok', mic: { id, ...micData } });
});

/**
 * @openapi
 * /mics/{id}:
 *   delete:
 *     summary: Delete an open mic
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
 *       404:
 *         description: Open mic not found
 */
app.delete('/mics/:id', (req, res) => {
  const { id } = req.params;
  // TODO: Add database delete
  res.json({ status: 'ok', id });
});

// everyting else
app.use((req, res) => {
  res.status(404).json({ error: 'resource not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'internal server error' });
});

module.exports = app;

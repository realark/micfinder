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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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


// Create a new mic
app.post('/mics', (req, res) => {
  const micData = req.body;
  // TODO: Add database insert
  res.json({ status: 'ok', mic: micData });
});

// Read a single mic
app.get('/mics/:id', (req, res) => {
  const { id } = req.params;
  // TODO: Add database query
  res.json({ status: 'ok', mic: { id } });
});

// Update a mic
app.put('/mics/:id', (req, res) => {
  const { id } = req.params;
  const micData = req.body;
  // TODO: Add database update
  res.json({ status: 'ok', mic: { id, ...micData } });
});

// Delete a mic
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

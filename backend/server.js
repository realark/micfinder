const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  // TODO: Add real auth later
  res.json({ status: 'ok' });
});

// Get mics within date range
app.get('/mics', (req, res) => {
  const { start, end } = req.query;
  // TODO: Add real database query later
  res.json({
    mics: [],
    start,
    end
  });
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

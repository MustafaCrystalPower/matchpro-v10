const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Load CSV data
let csvData = [];

function loadCSVData() {
  const csvPath = path.join(__dirname, 'data.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn('⚠️  data.csv not found. Using empty dataset.');
    csvData = [];
    return;
  }

  csvData = [];
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      csvData.push(row);
    })
    .on('end', () => {
      console.log(`✓ Loaded ${csvData.length} records from data.csv`);
    })
    .on('error', (err) => {
      console.error('Error reading CSV:', err.message);
    });
}

// Load data on startup
loadCSVData();

// API Routes
app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    count: csvData.length,
    data: csvData
  });
});

app.get('/api/data/:id', (req, res) => {
  const record = csvData.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }
  res.json({ success: true, data: record });
});

app.post('/api/data', (req, res) => {
  const newRecord = { id: Date.now().toString(), ...req.body };
  csvData.push(newRecord);
  res.status(201).json({ success: true, data: newRecord });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MatchPro API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Data endpoint: http://localhost:${PORT}/api/data`);
});


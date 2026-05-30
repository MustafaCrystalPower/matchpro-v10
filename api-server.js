const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check (Railway needs this)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '10.0',
    environment: process.env.NODE_ENV 
  });
});

// Your API routes
app.get('/api/listings', (req, res) => {
  res.json({ listings: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Import modular route handlers
const authRouter = require('./routes/auth');
const webhooksRouter = require('./routes/webhooks');

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI PR Reviewer Backend is running!' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

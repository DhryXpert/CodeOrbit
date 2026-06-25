require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const { rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

app.use('/api', limiter);

const authRouter = require('./routes/auth');
const webhooksRouter = require('./routes/webhooks');
const githubRouter = require('./routes/github');

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/github', githubRouter);

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

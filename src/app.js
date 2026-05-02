const path = require('path');
const fs = require('fs');

const envCandidates = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
require('dotenv').config({ path: envPath });
const express = require('express');
const { connectMySQL } = require('./configs/sql.config');
const { connectMongoDB } = require('./configs/mongodb.config');

const routes = require('./routes/route');
const {
  notFoundHandler,
  errorHandler,
} = require('./middlewares/error-handler.middleware');
const outboxProcessor = require('./services/outbox.processor');

// const { runMigration } = require('./configs/migration');

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (origin) {
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount routes
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await connectMongoDB();
    await connectMySQL();

    // Bỏ qua migration theo yêu cầu
    // await runMigration();

    // Khởi động Outbox Processor để xử lý alarm notification
    outboxProcessor.start();

    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

    const shutdown = () => {
      console.log('[Server] Shutting down...');
      outboxProcessor.stop();
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Server]Error starting server', error);
    process.exit(1);
  }
}

startServer();

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
// const { runMigration } = require('./configs/migration');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use(routes);

async function startServer() {
  try {
    await connectMongoDB();
    await connectMySQL();

    // Bỏ qua migration theo yêu cầu
    // await runMigration();

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('[Server]Error starting server', error);
    process.exit(1);
  }
}

startServer();

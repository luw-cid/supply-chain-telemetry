require('dotenv').config();
const express = require('express');
const { connectMySQL } = require('./configs/sql.config');
const { connectMongoDB } = require('./configs/mongodb.config');
const telemetryRouter = require('./routes/telemetry.route');
// const { runMigration } = require('./configs/migration');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/api', telemetryRouter);

async function startServer() {
    try {
        await connectMongoDB();
        await connectMySQL();
        
        // Tự động chạy migration khi khởi động
        await runMigration();

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

require('dotenv').config();
const express          = require('express');
const { connectMySQL } = require('./configs/sql.config');
const { connectMongoDB } = require('./configs/mongodb.config');
const telemetryRouter  = require('./routes/telemetry.route');
const outboxProcessor  = require('./services/outbox.processor'); // Task 10

const app  = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/api', telemetryRouter);

async function startServer() {
    try {
        // Kết nối databases
        await connectMongoDB();
        await connectMySQL();

        // Task 10: Khởi động Outbox Processor (background worker)
        // Processor sẽ quét bảng outbox_events mỗi 5 giây và gửi notification
        outboxProcessor.start();

        // Graceful shutdown: dừng processor trước khi tắt server
        process.on('SIGTERM', () => {
            console.log('[Server] SIGTERM received, shutting down gracefully...');
            outboxProcessor.stop();
            process.exit(0);
        });
        process.on('SIGINT', () => {
            console.log('[Server] SIGINT received, shutting down gracefully...');
            outboxProcessor.stop();
            process.exit(0);
        });

        app.listen(port, () => {
            console.log(`[Server] ✅ Running on port ${port}`);
        });

    } catch (error) {
        console.error('[Server] Error starting server', error);
        process.exit(1);
    }
}

startServer();

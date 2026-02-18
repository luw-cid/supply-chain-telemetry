// connect mongodb
const mongoose = require('mongoose');

async function connectMongoDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[MongoDB]Connected to', process.env.MONGO_DB_NAME);
    } catch (error) {
        console.error('[MongoDB]Error connecting to', process.env.MONGO_DB_NAME, error);
        throw error;
    }
}

module.exports = { connectMongoDB };
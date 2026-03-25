/**
 * Quick seed script - Seed telemetry data vào MongoDB
 * Sử dụng MONGO_URI từ .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const TelemetryPoints = require('../../models/mongodb/telemetry_points');

// Sử dụng MONGO_URI từ .env (MongoDB Atlas)
const MONGODB_URI = process.env.MONGO_URI;

console.log('Connecting to:', MONGODB_URI ? 'MongoDB Atlas' : 'localhost');

async function quickSeed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clean old data
    console.log('Cleaning old data...');
    await TelemetryPoints.deleteMany({ 'meta.shipment_id': { $in: ['SH001', 'SH002', 'SH003'] } });
    
    // Generate data for SH001
    console.log('Generating data for SH001...');
    const points = [];
    const now = new Date();
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now.getTime() - (100 - i) * 30 * 60 * 1000); // 30 min intervals
      const lng = 103.8198 + (i / 100) * 10; // Singapore to somewhere east
      const lat = 1.3521 + (i / 100) * 20; // Moving north
      const temp = 5 + Math.random() * 10; // 5-15°C (some violations above 8°C)
      const humidity = 50 + Math.random() * 20;
      
      points.push({
        meta: {
          shipment_id: 'SH001',
          device_id: 'IOT-DEVICE-001'
        },
        t: timestamp,
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        temp: parseFloat(temp.toFixed(2)),
        humidity: parseFloat(humidity.toFixed(2))
      });
    }
    
    await TelemetryPoints.insertMany(points);
    console.log(`✅ Inserted ${points.length} points for SH001`);
    
    // Verify
    const count = await TelemetryPoints.countDocuments({ 'meta.shipment_id': 'SH001' });
    console.log(`✅ Verified: ${count} points in database`);
    
    console.log('\n✅ SEED COMPLETED!');
    console.log('You can now test: curl http://localhost:3000/api/v1/analytics/trace-route/SH001');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

quickSeed();

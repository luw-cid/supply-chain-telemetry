/**
 * ============================================================================
 * SEED SCRIPT: Add VNCMY (Cam Ranh Port) outbound routes
 * ============================================================================
 * Fixes: "Origin port VNCMY exists but has no active outbound routes" error
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const PortEdges = require('../../models/mongodb/port_edges');

async function seedVncmyRoutes() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] ✓ Connected to MongoDB');

    // Define VNCMY outbound routes
    const vncmyRoutes = [
      {
        from_port: 'VNCMY',
        to_port: 'VNHPH',
        route_type: 'SEA',
        distance_km: 650,
        avg_hours: 20,
        min_hours: 16,
        max_hours: 28,
        std_dev_hours: 2.1,
        samples: 95,
        alarm_rate: 0.02,
        is_active: true,
        last_updated: new Date('2026-04-16T00:00:00.000Z')
      },
      {
        from_port: 'VNCMY',
        to_port: 'SGSIN',
        route_type: 'SEA',
        distance_km: 1850,
        avg_hours: 48,
        min_hours: 44,
        max_hours: 56,
        std_dev_hours: 3.2,
        samples: 140,
        alarm_rate: 0.04,
        is_active: true,
        last_updated: new Date('2026-04-16T00:00:00.000Z')
      },
      {
        from_port: 'VNCMY',
        to_port: 'HKHKG',
        route_type: 'SEA',
        distance_km: 2100,
        avg_hours: 58,
        min_hours: 50,
        max_hours: 68,
        std_dev_hours: 4.0,
        samples: 110,
        alarm_rate: 0.05,
        is_active: true,
        last_updated: new Date('2026-04-16T00:00:00.000Z')
      }
    ];

    // Check if VNCMY routes already exist
    const existingCount = await PortEdges.countDocuments({ from_port: 'VNCMY' });
    if (existingCount > 0) {
      console.log(`[Seed] ⚠ Found ${existingCount} existing VNCMY routes. Removing them first...`);
      await PortEdges.deleteMany({ from_port: 'VNCMY' });
    }

    // Insert new VNCMY routes
    const inserted = await PortEdges.insertMany(vncmyRoutes);
    console.log(`[Seed] ✓ Inserted ${inserted.length} VNCMY outbound routes`);
    
    // Verify insertion
    const vncmyCount = await PortEdges.countDocuments({ from_port: 'VNCMY' });
    console.log(`[Seed] ✓ Total VNCMY routes in database: ${vncmyCount}`);
    
    // List all VNCMY routes
    const allVncmyRoutes = await PortEdges.find({ from_port: 'VNCMY' });
    console.log('\n[Seed] VNCMY Routes:');
    allVncmyRoutes.forEach((route) => {
      console.log(`  - ${route.from_port} → ${route.to_port} (${route.route_type}, ${route.avg_hours}h, alarm_rate: ${(route.alarm_rate * 100).toFixed(1)}%)`);
    });

    console.log('\n[Seed] ✓ VNCMY routes seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] ✗ Error:', error);
    process.exit(1);
  }
}

seedVncmyRoutes();

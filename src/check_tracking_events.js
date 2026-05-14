const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://huy112005:huy112005@supply-chain-mongodb.66frpfi.mongodb.net/SupplyChain_mongodb?appName=SupplyChain';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('supply_chain_mongodb');

  // List all collections
  const cols = await db.listCollections().toArray();
  console.log('=== Collections ===');
  console.log(cols.map(c => c.name));

  // Check tracking_events for this shipment
  const events = await db.collection('tracking_events')
    .find({ shipment_id: 'SHP-1778733967789' })
    .toArray();
  console.log('\n=== Tracking Events for SHP-1778733967789 ===');
  console.log('Count:', events.length);
  console.log(JSON.stringify(events, null, 2));

  // Check total tracking events in DB
  const total = await db.collection('tracking_events').countDocuments();
  console.log('\n=== Total tracking_events in DB:', total);

  // Sample 3 events to understand structure
  const sample = await db.collection('tracking_events').find({}).limit(3).toArray();
  console.log('\n=== Sample Events ===');
  console.log(JSON.stringify(sample, null, 2));

  await client.close();
}

main().catch(console.error);

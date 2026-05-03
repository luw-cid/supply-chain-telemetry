/**
 * Seed port_edges với dữ liệu shipping route thực tế
 * - Khoảng cách (km) tính theo đường biển thực qua các eo biển
 * - Waypoints đi theo shipping lane thực tế (South China Sea, Malacca, etc.)
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const PortEdges = require('../../models/mongodb/port_edges');

// Cảng và tọa độ
const PORTS = {
  VNSGN: { name: 'Saigon Port', lat: 10.75, lng: 106.72, region: 'vietnam_south' },
  VNCMY: { name: 'Cam Ranh', lat: 12.2388, lng: 109.1967, region: 'vietnam_central' },
  VNDAD: { name: 'Da Nang', lat: 16.098, lng: 108.234, region: 'vietnam_central' },
  VNHPH: { name: 'Hai Phong', lat: 20.8449, lng: 106.6881, region: 'vietnam_north' },
  VNHPG: { name: 'Haiphong', lat: 20.87, lng: 106.68, region: 'vietnam_north' },
  SGSIN: { name: 'Singapore', lat: 1.27, lng: 103.83, region: 'singapore' },
  MYPNG: { name: 'Penang', lat: 5.4164, lng: 100.3327, region: 'malaysia_west' },
  IDJKT: { name: 'Tanjung Priok', lat: -6.1078, lng: 106.8834, region: 'indonesia' },
  THBKK: { name: 'Laem Chabang', lat: 13.0939, lng: 100.92, region: 'thailand' },
  PHMNL: { name: 'Manila', lat: 14.6208, lng: 120.9437, region: 'philippines' },
  LKAHL: { name: 'Colombo', lat: 6.9397, lng: 79.8382, region: 'sri_lanka' },
  INMUN: { name: 'Jawaharlal Nehru', lat: 18.949, lng: 72.952, region: 'india_west' },
  TWKEZ: { name: 'Kaohsiung', lat: 22.5667, lng: 120.3014, region: 'taiwan' },
};

// === MARITIME CHOKEPOINTS (Eo biển/điểm điều hướng chính) ===
const CHOKEPOINTS = {
  // Eo biển Malacca (giữa Malaysia và Sumatra)
  malacca_north: { lat: 5.5, lng: 99.0, desc: 'Northern Malacca Strait' },
  malacca_mid: { lat: 3.5, lng: 100.5, desc: 'Central Malacca Strait' },
  malacca_south: { lat: 1.5, lng: 102.5, desc: 'Southern Malacca Strait' },
  // Eo biển Singapore
  singapore_east: { lat: 1.2, lng: 104.5, desc: 'East of Singapore' },
  singapore_west: { lat: 1.1, lng: 103.5, desc: 'West of Singapore' },
  // Biển Đông (South China Sea)
  scs_central: { lat: 8.0, lng: 110.0, desc: 'Central South China Sea' },
  scs_south: { lat: 3.0, lng: 107.0, desc: 'Southern South China Sea' },
  scs_north: { lat: 16.0, lng: 112.0, desc: 'Northern South China Sea' },
  // Eo biển Karimata (giữa Borneo và Sumatra)
  karimata: { lat: -2.0, lng: 108.5, desc: 'Karimata Strait' },
  // Biển Java
  java_sea: { lat: -5.0, lng: 107.5, desc: 'Java Sea' },
  // Eo biển Sunda
  sunda: { lat: -6.5, lng: 105.0, desc: 'Sunda Strait' },
  // Vịnh Thái Lan
  thai_gulf: { lat: 9.0, lng: 103.0, desc: 'Gulf of Thailand' },
  // Eo Đài Loan
  taiwan_strait: { lat: 24.0, lng: 119.5, desc: 'Taiwan Strait' },
  // Philippines
  ph_south: { lat: 10.0, lng: 122.0, desc: 'Southern Philippines' },
  ph_east: { lat: 15.0, lng: 124.0, desc: 'East of Philippines' },
  // Ấn Độ Dương
  indian_ocean: { lat: 5.0, lng: 90.0, desc: 'Indian Ocean' },
  // Eo biển Lombok
  lombok: { lat: -8.5, lng: 116.0, desc: 'Lombok Strait' },
};

// === SHIPPING LANE ROUTES (tuyến đường biển thực tế) ===
// Mỗi route là mảng [waypoint_key, ...] nối từ port này đến port kia
const SHIPPING_ROUTES = {
  // === VIETNAM ↔ SINGAPORE / MALAYSIA ===
  'VNSGN_SGSIN': ['scs_south', 'singapore_east'],
  'VNSGN_MYPNG': ['scs_south', 'malacca_south', 'malacca_mid', 'malacca_north'],
  'VNCMY_SGSIN': ['scs_central', 'scs_south', 'singapore_east'],
  'VNCMY_MYPNG': ['scs_central', 'scs_south', 'malacca_south', 'malacca_mid'],
  'VNDAD_SGSIN': ['scs_north', 'scs_central', 'scs_south', 'singapore_east'],
  'VNDAD_MYPNG': ['scs_north', 'scs_central', 'scs_south', 'malacca_south', 'malacca_mid'],
  'VNHPH_SGSIN': ['scs_north', 'scs_central', 'scs_south', 'singapore_east'],
  'VNHPG_SGSIN': ['scs_north', 'scs_central', 'scs_south', 'singapore_east'],
  
  // === VIETNAM ↔ INDONESIA ===
  'VNSGN_IDJKT': ['scs_south', 'karimata', 'java_sea'],
  'VNCMY_IDJKT': ['scs_central', 'scs_south', 'karimata', 'java_sea'],
  'VNDAD_IDJKT': ['scs_north', 'scs_central', 'scs_south', 'karimata', 'java_sea'],
  'VNHPH_IDJKT': ['scs_north', 'scs_central', 'scs_south', 'karimata', 'java_sea'],
  'VNHPG_IDJKT': ['scs_north', 'scs_central', 'scs_south', 'karimata', 'java_sea'],
  
  // === VIETNAM ↔ THAILAND ===
  'VNSGN_THBKK': ['thai_gulf'],
  'VNCMY_THBKK': ['scs_central', 'thai_gulf'],
  'VNDAD_THBKK': ['scs_north', 'scs_central', 'thai_gulf'],
  
  // === VIETNAM ↔ PHILIPPINES ===
  'VNSGN_PHMNL': ['scs_south', 'ph_south'],
  'VNCMY_PHMNL': ['scs_central', 'ph_south'],
  'VNDAD_PHMNL': ['scs_north', 'ph_east'],
  
  // === VIETNAM ↔ TAIWAN ===
  'VNSGN_TWKEZ': ['scs_central', 'scs_north', 'taiwan_strait'],
  'VNCMY_TWKEZ': ['scs_central', 'scs_north', 'taiwan_strait'],
  'VNDAD_TWKEZ': ['scs_north', 'taiwan_strait'],
  'VNHPH_TWKEZ': ['scs_north', 'taiwan_strait'],
  'VNHPG_TWKEZ': ['scs_north', 'taiwan_strait'],
  
  // === VIETNAM ↔ ẤN ĐỘ / SRI LANKA ===
  'VNSGN_LKAHL': ['scs_south', 'singapore_east', 'singapore_west', 'malacca_south', 'malacca_mid', 'malacca_north', 'indian_ocean'],
  'VNSGN_INMUN': ['scs_south', 'singapore_east', 'singapore_west', 'malacca_south', 'malacca_mid', 'malacca_north', 'indian_ocean'],
  
  // === SINGAPORE ↔ INDONESIA ===
  'SGSIN_IDJKT': ['singapore_east', 'karimata', 'java_sea'],
  'MYPNG_IDJKT': ['malacca_mid', 'malacca_south', 'singapore_east', 'karimata', 'java_sea'],
  'SGSIN_LKAHL': ['singapore_west', 'malacca_south', 'malacca_mid', 'malacca_north', 'indian_ocean'],
  'MYPNG_LKAHL': ['malacca_north', 'indian_ocean'],
  'SGSIN_INMUN': ['singapore_west', 'malacca_south', 'malacca_mid', 'malacca_north', 'indian_ocean'],
  'MYPNG_INMUN': ['malacca_north', 'indian_ocean'],
  
  // === SINGAPORE ↔ THAILAND ===
  'SGSIN_THBKK': ['singapore_east', 'scs_south', 'thai_gulf'],
  'MYPNG_THBKK': ['malacca_mid', 'malacca_south', 'singapore_east', 'scs_south', 'thai_gulf'],
  
  // === SINGAPORE ↔ PHILIPPINES ===
  'SGSIN_PHMNL': ['singapore_east', 'scs_south', 'ph_south'],
  'MYPNG_PHMNL': ['malacca_mid', 'malacca_south', 'singapore_east', 'scs_south', 'ph_south'],
  
  // === SINGAPORE ↔ TAIWAN ===
  'SGSIN_TWKEZ': ['singapore_east', 'scs_south', 'scs_central', 'scs_north', 'taiwan_strait'],
  'MYPNG_TWKEZ': ['malacca_mid', 'malacca_south', 'singapore_east', 'scs_south', 'scs_central', 'scs_north', 'taiwan_strait'],
  
  // === INDONESIA ↔ THAILAND ===
  'IDJKT_THBKK': ['java_sea', 'karimata', 'scs_south', 'thai_gulf'],
  
  // === INDONESIA ↔ PHILIPPINES ===
  'IDJKT_PHMNL': ['java_sea', 'karimata', 'scs_south', 'ph_south'],
  
  // === INDONESIA ↔ TAIWAN ===
  'IDJKT_TWKEZ': ['java_sea', 'karimata', 'scs_south', 'scs_central', 'scs_north', 'taiwan_strait'],
  
  // === THAILAND ↔ PHILIPPINES ===
  'THBKK_PHMNL': ['thai_gulf', 'scs_south', 'ph_south'],
  
  // === THAILAND ↔ TAIWAN ===
  'THBKK_TWKEZ': ['thai_gulf', 'scs_south', 'scs_central', 'scs_north', 'taiwan_strait'],
  
  // === PHILIPPINES ↔ TAIWAN ===
  'PHMNL_TWKEZ': ['ph_east'],
  
  // === ẤN ĐỘ / SRI LANKA ↔ CÁC CẢNG KHÁC ===
  'LKAHL_INMUN': ['indian_ocean'],
  'LKAHL_IDJKT': ['indian_ocean', 'malacca_north', 'malacca_mid', 'malacca_south', 'singapore_east', 'karimata', 'java_sea'],
  'INMUN_IDJKT': ['indian_ocean', 'malacca_north', 'malacca_mid', 'malacca_south', 'singapore_east', 'karimata', 'java_sea'],
  'LKAHL_THBKK': ['indian_ocean', 'malacca_north', 'malacca_mid', 'malacca_south', 'singapore_east', 'scs_south', 'thai_gulf'],
  'LKAHL_TWKEZ': ['indian_ocean', 'malacca_north', 'malacca_mid', 'malacca_south', 'singapore_east', 'scs_south', 'scs_central', 'scs_north', 'taiwan_strait'],
  'INMUN_TWKEZ': ['indian_ocean', 'malacca_north', 'malacca_mid', 'malacca_south', 'singapore_east', 'scs_south', 'scs_central', 'scs_north', 'taiwan_strait'],
};

// Thêm reverse routes
function addReverseRoutes() {
  for (const [key, waypoints] of Object.entries(SHIPPING_ROUTES)) {
    const [from, to] = key.split('_');
    const reverseKey = to + '_' + from;
    if (!SHIPPING_ROUTES[reverseKey]) {
      SHIPPING_ROUTES[reverseKey] = [...waypoints].reverse();
    }
  }
}
addReverseRoutes();

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateSeaWaypoints(fromLat, fromLng, toLat, toLng, chokepointKeys, stepsPerSegment = 12) {
  const waypoints = [{ lat: fromLat, lng: fromLng }];
  
  for (const cpKey of chokepointKeys) {
    const cp = CHOKEPOINTS[cpKey];
    if (cp) waypoints.push({ lat: cp.lat, lng: cp.lng });
  }
  
  waypoints.push({ lat: toLat, lng: toLng });
  
  // Interpolate between each pair of waypoints for smooth path
  const smoothPoints = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const steps = stepsPerSegment;
    for (let j = 0; j < steps; j++) {
      const f = j / steps;
      const lat = a.lat + (b.lat - a.lat) * f;
      const lng = a.lng + (b.lng - a.lng) * f;
      smoothPoints.push({ lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 });
    }
  }
  smoothPoints.push({ lat: Math.round(toLat * 10000) / 10000, lng: Math.round(toLng * 10000) / 10000 });
  
  return smoothPoints;
}

// Tính khoảng cách biển thực tế (tổng haversine của từng segment)
function calculateSeaDistance(waypoints) {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversine(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
  }
  return total;
}

function generateAlarmRate(from, to) {
  const highRisk = ['IDJKT', 'PHMNL'];
  const medRisk = ['LKAHL', 'INMUN', 'VNCMY'];
  let base = 0.02;
  if (highRisk.includes(from) || highRisk.includes(to)) base = 0.07;
  else if (medRisk.includes(from) || medRisk.includes(to)) base = 0.04;
  return Math.round((base + (Math.random() - 0.5) * 0.02) * 1000) / 1000;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.db.databaseName;
  console.log('Connected to:', dbName);

  await PortEdges.deleteMany({});
  console.log('Cleared port_edges');

  const codes = Object.keys(PORTS);
  let count = 0;

  for (let i = 0; i < codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      if (i === j) continue;
      const from = PORTS[codes[i]];
      const to = PORTS[codes[j]];
      const routeKey = codes[i] + '_' + codes[j];

      // Get shipping lane waypoints or fall back to great-circle
      let seaWaypoints;
      if (SHIPPING_ROUTES[routeKey]) {
        seaWaypoints = generateSeaWaypoints(from.lat, from.lng, to.lat, to.lng, SHIPPING_ROUTES[routeKey]);
      } else {
        // Fallback: direct path with curvature
        const dist = haversine(from.lat, from.lng, to.lat, to.lng);
        if (dist < 100) continue; // Skip very close ports
        const steps = 15;
        seaWaypoints = [];
        for (let k = 0; k <= steps; k++) {
          const f = k / steps;
          const lat = from.lat + (to.lat - from.lat) * f;
          const lng = from.lng + (to.lng - from.lng) * f;
          const curve = Math.sin(f * Math.PI) * 2.5;
          seaWaypoints.push({ lat: Math.round((lat + curve * 0.15) * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 });
        }
      }

      const seaDist = calculateSeaDistance(seaWaypoints);
      if (seaDist < 100) continue;

      const speedKnots = 16; // Average container ship speed (knots)
      const hours = seaDist / (speedKnots * 1.852); // 1 knot = 1.852 km/h
      const alarmRate = generateAlarmRate(codes[i], codes[j]);

      // Store waypoints as GeoJSON LineString coordinates
      const routePath = seaWaypoints.map(w => [w.lng, w.lat]);

      await PortEdges.create({
        from_port: codes[i],
        to_port: codes[j],
        route_type: 'SEA',
        distance_km: Math.round(seaDist),
        avg_hours: Math.round(hours * 10) / 10,
        min_hours: Math.round(hours * 0.85 * 10) / 10,
        max_hours: Math.round(hours * 1.2 * 10) / 10,
        std_dev_hours: Math.round(hours * 0.12 * 10) / 10,
        samples: Math.floor(Math.random() * 200) + 50,
        alarm_rate: alarmRate,
        is_active: true,
        route_path: { type: 'LineString', coordinates: routePath },
      });
      count++;
    }
  }

  console.log(`Seeded ${count} port_edges with real shipping routes`);

  // Verify some routes
  const sampleRoutes = [
    ['VNSGN', 'SGSIN'], ['VNSGN', 'IDJKT'], ['SGSIN', 'TWKEZ'],
    ['VNSGN', 'LKAHL'], ['VNSGN', 'TWKEZ'], ['SGSIN', 'IDJKT'],
  ];
  console.log('\nSample routes:');
  for (const [from, to] of sampleRoutes) {
    const edge = await PortEdges.findOne({ from_port: from, to_port: to }).lean();
    if (edge) {
      const pts = edge.route_path?.coordinates?.length || 0;
      console.log(`  ${from} -> ${to}: ${edge.distance_km}km, ${edge.avg_hours}h, ${pts} waypoints`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });

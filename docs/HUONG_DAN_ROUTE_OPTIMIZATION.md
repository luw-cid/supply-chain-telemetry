# Hướng Dẫn Route Optimization - Dành cho Sinh Viên CNTT

## 📚 Giới Thiệu

Tài liệu này giải thích cách sử dụng **MongoDB $graphLookup** để giải quyết bài toán **Tối ưu lộ trình** trong dự án Global Supply Chain.

---

## 🎯 Mục Tiêu

Tìm lộ trình tối ưu từ **Cảng A** đến **Cảng B** với các tiêu chí:
- ✅ Thời gian vận chuyển ngắn nhất
- ✅ Tỷ lệ cảnh báo thấp nhất (tránh tuyến đường rủi ro cao)
- ✅ Số trạm dừng ít nhất

---

## 🧠 Kiến Thức Cần Có

### 1. Graph Theory (Lý thuyết đồ thị)

**Đồ thị là gì?**
- **Nodes (Đỉnh):** Các cảng (VNSGN, SGSIN, USNYC, ...)
- **Edges (Cạnh):** Tuyến đường nối giữa các cảng
- **Weights (Trọng số):** Thời gian di chuyển, tỷ lệ rủi ro

**Ví dụ:**
```
VNSGN ──48h──> SGSIN ──72h──> HKHKG ──360h──> USNYC
  │
  └──60h──> MYTPP ──144h──> JPTYO ──312h──> USNYC
```

### 2. MongoDB $graphLookup

**$graphLookup là gì?**
- Công cụ của MongoDB để duyệt đồ thị (graph traversal)
- Tương tự như **Recursive CTE** trong SQL
- Tìm tất cả các node liên kết với nhau

**Cú pháp cơ bản:**
```javascript
{
  $graphLookup: {
    from: "port_edges",              // Collection chứa dữ liệu
    startWith: "$to_port",            // Điểm bắt đầu
    connectFromField: "to_port",      // Field để nối (từ)
    connectToField: "from_port",      // Field để nối (đến)
    as: "possible_routes",            // Tên mảng kết quả
    maxDepth: 3,                      // Số bước nhảy tối đa
    depthField: "transit_stop",       // Đánh dấu độ sâu
    restrictSearchWithMatch: {        // Điều kiện lọc
      alarm_rate: { $lt: 0.1 }
    }
  }
}
```

---

## 🔍 Cách Hoạt Động (Step-by-Step)

### Bước 1: Chuẩn bị dữ liệu

**Collection: port_edges**
```javascript
{
  from_port: "VNSGN",      // Cảng xuất phát
  to_port: "SGSIN",        // Cảng đích
  avg_hours: 48,           // Thời gian trung bình (giờ)
  distance_km: 1200,       // Khoảng cách (km)
  alarm_rate: 0.06,        // Tỷ lệ cảnh báo (6%)
  route_type: "SEA",       // Loại vận chuyển
  is_active: true          // Còn hoạt động?
}
```

### Bước 2: Thực thi $graphLookup

**Query:**
```javascript
db.port_edges.aggregate([
  // Lọc điểm xuất phát
  { $match: { from_port: "VNSGN" } },
  
  // Duyệt đồ thị
  {
    $graphLookup: {
      from: "port_edges",
      startWith: "$to_port",
      connectFromField: "to_port",
      connectToField: "from_port",
      as: "possible_routes",
      maxDepth: 3,
      depthField: "transit_stop",
      restrictSearchWithMatch: {
        alarm_rate: { $lt: 0.1 },  // Chỉ lấy tuyến có alarm < 10%
        is_active: true
      }
    }
  }
])
```

**Kết quả (Mảng phẳng - Flattened Array):**
```javascript
{
  from_port: "VNSGN",
  to_port: "SGSIN",
  possible_routes: [
    { from_port: "SGSIN", to_port: "HKHKG", transit_stop: 0 },
    { from_port: "SGSIN", to_port: "USNYC", transit_stop: 0 },
    { from_port: "HKHKG", to_port: "USNYC", transit_stop: 1 },
    { from_port: "HKHKG", to_port: "JPTYO", transit_stop: 1 },
    { from_port: "JPTYO", to_port: "USNYC", transit_stop: 2 }
  ]
}
```

### Bước 3: Xây dựng lại đường đi (Path Reconstruction)

⚠️ **Vấn đề:** $graphLookup trả về **mảng phẳng**, không phải cây lồng nhau!

**Giải pháp:** Viết thuật toán **Backtracking** để ghép các cạnh lại thành đường đi hoàn chỉnh.

**Thuật toán:**
```javascript
function reconstructPath(firstLeg, allEdges, finalEdge) {
  const path = [firstLeg];
  let currentEdge = finalEdge;
  let currentDepth = finalEdge.transit_stop;
  
  // Lùi từ đích về gốc
  while (currentDepth > 0) {
    // Tìm cạnh ở độ sâu trước đó
    const previousEdge = allEdges.find(edge =>
      edge.to_port === currentEdge.from_port &&
      edge.transit_stop === currentDepth - 1
    );
    
    if (!previousEdge) return null;  // Không tìm thấy
    
    path.unshift(previousEdge);
    currentEdge = previousEdge;
    currentDepth--;
  }
  
  path.push(finalEdge);
  return path;
}
```

**Ví dụ:**
```
Input: Mảng phẳng
[
  { from: "SGSIN", to: "HKHKG", depth: 0 },
  { from: "HKHKG", to: "USNYC", depth: 1 }
]

Output: Đường đi hoàn chỉnh
VNSGN → SGSIN → HKHKG → USNYC
```

### Bước 4: Xếp hạng (Ranking)

**Công thức tính điểm tối ưu:**
```javascript
score = 0.5 × (thời_gian / 1000) + 
        0.3 × tỷ_lệ_rủi_ro + 
        0.2 × (số_trạm_dừng / 3)
```

**Điểm thấp hơn = Tốt hơn**

---

## 💻 Cách Sử Dụng

### 1. Tìm lộ trình cơ bản

```javascript
const { getOptimalRoutes } = require('./services/route_optimization.service');

const result = await getOptimalRoutes('VNSGN', 'USNYC');

console.log(`Tìm thấy ${result.routes.length} lộ trình`);
console.log(`Lộ trình tốt nhất: ${result.routes[0].path.join(' → ')}`);
```

### 2. Tùy chỉnh điều kiện

```javascript
const result = await getOptimalRoutes('VNSGN', 'USNYC', {
  maxTransitStops: 2,      // Tối đa 2 trạm dừng
  maxAlarmRate: 0.05,      // Chỉ chấp nhận alarm < 5%
  maxRoutes: 3,            // Trả về top 3
  routeType: 'SEA'         // Chỉ đường biển
});
```

### 3. Gợi ý cho loại hàng cụ thể

```javascript
const { getRouteRecommendationsForCargo } = require('./services/route_optimization.service');

const result = await getRouteRecommendationsForCargo(
  'VNSGN',
  'USNYC',
  {
    cargo_type: 'VACCINE',   // Vắc-xin
    temp_min: 2,
    temp_max: 8,
    is_fragile: true
  }
);

// Kết quả sẽ có gợi ý cụ thể cho vắc-xin
console.log(result.cargo_specific_notes.recommendations);
```

---

## 🧪 Testing

### Chạy test

```bash
# Chạy tất cả tests
node src/database/test/test_route_optimization.js

# Kết quả mong đợi:
# ✓ TEST 1: Basic Route Finding - PASSED
# ✓ TEST 2: Direct Route Detection - PASSED
# ✓ TEST 3: Alarm Rate Filtering - PASSED
# ✓ TEST 4: Max Transit Stops - PASSED
# ✓ TEST 5: Service Layer - PASSED
# ✓ TEST 6: Performance - PASSED
# ✓ TEST 7: Path Reconstruction - PASSED
```

### Tạo dữ liệu test

```javascript
const { generateTestData } = require('./src/database/test/test_route_optimization');

await generateTestData();
// Tạo mạng lưới test với ~10 cảng và 15 tuyến đường
```

---

## 📊 Kết Quả Mẫu

```json
{
  "success": true,
  "routes": [
    {
      "rank": 1,
      "path": ["VNSGN", "SGSIN", "USNYC"],
      "summary": {
        "total_stops": 1,
        "total_hours": 432,
        "total_distance_km": 15000,
        "avg_alarm_rate": 0.075,
        "optimization_score": 0.289
      },
      "recommendation": "RECOMMENDED"
    }
  ],
  "insights": [
    {
      "type": "FAST_DELIVERY",
      "message": "Fastest route delivers in 432 hours"
    }
  ],
  "metadata": {
    "execution_time_ms": 87
  }
}
```

---

## 🔧 Troubleshooting

### Vấn đề 1: Không tìm thấy lộ trình

**Nguyên nhân:**
- Cảng không tồn tại trong database
- Điều kiện lọc quá chặt (maxAlarmRate quá thấp)
- Không có đường đi từ A đến B

**Giải pháp:**
```javascript
// Kiểm tra dữ liệu
db.port_edges.find({ from_port: "VNSGN" })

// Nới lỏng điều kiện
const result = await getOptimalRoutes('VNSGN', 'USNYC', {
  maxAlarmRate: 0.15,  // Tăng lên 15%
  maxTransitStops: 5   // Tăng số trạm dừng
});
```

### Vấn đề 2: Query chậm

**Nguyên nhân:**
- Thiếu index
- maxDepth quá cao
- Đồ thị quá lớn

**Giải pháp:**
```javascript
// Tạo index
db.port_edges.createIndex({ from_port: 1, to_port: 1 });
db.port_edges.createIndex({ alarm_rate: 1 });

// Giảm maxDepth
const result = await getOptimalRoutes('VNSGN', 'USNYC', {
  maxTransitStops: 2  // Giảm từ 3 xuống 2
});
```

---

## 📖 Tài Liệu Tham Khảo

### MongoDB Documentation
- [MongoDB $graphLookup](https://www.mongodb.com/docs/manual/reference/operator/aggregation/graphLookup/)
- [Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/)

### Video Tutorials
- [MongoDB $graphLookup Tutorial](https://www.youtube.com/watch?v=example) - Giải thích vấn đề "flattened array"

### Tài liệu dự án
- `docs/ROUTE_OPTIMIZATION_TECHNICAL_GUIDE.md` - Tài liệu kỹ thuật chi tiết (tiếng Anh)
- `docs/design.md` - Thiết kế hệ thống tổng thể
- `src/database/mongo/route_optimization_aggregation.js` - Source code có comment chi tiết

---

## 💡 Tips cho Sinh Viên

### 1. Hiểu rõ "Flattened Array Problem"

⚠️ **Sai lầm phổ biến:** Nghĩ rằng $graphLookup trả về cây lồng nhau

✅ **Thực tế:** $graphLookup trả về mảng phẳng, cần thuật toán để ghép lại

### 2. Sử dụng depthField

```javascript
depthField: "transit_stop"  // QUAN TRỌNG!
```

Không có field này, bạn không thể biết node nào ở độ sâu nào → Không reconstruct được path!

### 3. Test với dữ liệu nhỏ trước

```javascript
// Bắt đầu với 3-5 nodes
// Sau đó mở rộng lên 10-20 nodes
// Cuối cùng test với 100+ nodes
```

### 4. Vẽ đồ thị ra giấy

```
VNSGN ──> SGSIN ──> HKHKG ──> USNYC
  │          │
  └──> MYTPP └──> USNYC
```

Giúp bạn hiểu rõ thuật toán hơn!

### 5. Đọc kỹ MongoDB Docs

Link: https://www.mongodb.com/docs/manual/reference/operator/aggregation/graphLookup/

Đặc biệt phần "Behavior" và "Examples"

---

## 🎓 Bài Tập Thực Hành

### Bài 1: Cơ bản
Tìm lộ trình từ VNSGN đến USNYC với tối đa 2 trạm dừng.

### Bài 2: Nâng cao
Tìm lộ trình có tổng thời gian < 400 giờ và alarm_rate < 5%.

### Bài 3: Thách thức
Viết thuật toán tìm **tất cả** các lộ trình khả thi (không giới hạn số lượng).

### Bài 4: Tối ưu
Cải thiện performance của query khi có > 1000 edges trong database.

---

## ✅ Checklist Hoàn Thành

- [ ] Hiểu được Graph Theory cơ bản
- [ ] Biết cách sử dụng $graphLookup
- [ ] Hiểu vấn đề "Flattened Array"
- [ ] Viết được thuật toán Path Reconstruction
- [ ] Chạy được test suite thành công
- [ ] Tạo được dữ liệu test
- [ ] Tối ưu được query với indexes
- [ ] Hiểu được cách ranking routes

---

**Chúc bạn học tốt! 🚀**

Nếu có thắc mắc, tham khảo:
- File source code có comment chi tiết
- Tài liệu kỹ thuật (ROUTE_OPTIMIZATION_TECHNICAL_GUIDE.md)
- MongoDB documentation

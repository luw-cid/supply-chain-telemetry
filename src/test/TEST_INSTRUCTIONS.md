# Hướng dẫn chạy test Chain of Custody API

## Vấn đề đã fix

1. **Lỗi SQL "Data too long for column"**: Đã thêm CAST với độ dài đủ lớn cho các cột trong Recursive CTE
   - `previous_owner_party_id`: CHAR(32)
   - `previous_owner_name`: CHAR(255)
   - `previous_owner_type`: CHAR(32)
   - `transfer_sequence_path`: CHAR(1000)

2. **Thiếu field `code` trong handoverPort**: Đã thêm `HandoverPortCode` vào SELECT statement

3. **totalTransfers không khớp**: Đã sửa để trả về `chain.length` thay vì query riêng

## Cách chạy test

### Option 1: Chạy tự động (Khuyến nghị)

```bash
cd src
reset_and_test.bat
```

Script này sẽ:
1. Reset test data (xóa và tạo lại)
2. Reload stored procedure
3. Chạy test suite

### Option 2: Chạy thủ công

```bash
# Bước 1: Reset test data
cd src
mysql -u root supply_chain_sql < reset_test_data.sql

# Bước 2: Reload stored procedure
mysql -u root supply_chain_sql < database\sql\recursive_cte_chain_of_custody.sql

# Bước 3: Chạy test
npx mocha --timeout 15000 test/test_custody_api.js
```

## Lưu ý quan trọng

- **Phải reset data trước mỗi lần chạy test** vì các test cases tạo thêm ownership records qua API
- Nếu test fail với số lượng records không đúng, hãy chạy lại `reset_test_data.sql`
- Server phải đang chạy trên port 3000 (`node app.js`)

## Các file đã tạo/sửa

1. `src/database/sql/recursive_cte_chain_of_custody.sql` - Fixed CAST issues
2. `src/services/custody.service.js` - Fixed totalTransfers calculation
3. `src/reset_test_data.sql` - Script để reset test data
4. `src/reset_and_test.bat` - Script tự động reset + test
5. `src/reload_sp.bat` - Script để reload stored procedure

## Kết quả mong đợi

Tất cả 40 test cases sẽ pass:
- 4 Authentication Guard tests
- 6 Input Validation tests
- 6 Business Rules tests
- 2 Response Schema tests
- 9 Ownership History DETAILED tests
- 5 Ownership History SUMMARY tests
- 3 Error Cases tests
- 5 Data Integrity tests

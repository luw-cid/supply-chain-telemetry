# Requirements Document

## Introduction

Dự án Global Supply Chain & Asset Telemetry hiện đang sử dụng kiến trúc hybrid database (MySQL + MongoDB) để quản lý logistics toàn cầu cho hàng hóa nhạy cảm như vaccine và dược phẩm. Sau khi phân tích chi tiết, hệ thống cần được cải tiến để đáp ứng đầy đủ các yêu cầu về tính toàn vẹn dữ liệu, hiệu năng, và khả năng mở rộng.

Tài liệu này định nghĩa các yêu cầu cải tiến cơ sở dữ liệu theo thứ tự ưu tiên, tập trung vào việc bổ sung các cột thiếu, tạo constraints, indexes, triggers, stored procedures, và views để nâng cao chất lượng hệ thống.

## Glossary

- **MySQL_Database**: Hệ quản trị cơ sở dữ liệu quan hệ lưu trữ dữ liệu có cấu trúc (legal documentation, chain of custody)
- **MongoDB_Database**: Hệ quản trị cơ sở dữ liệu NoSQL lưu trữ dữ liệu time-series và IoT sensor data
- **Shipment**: Lô hàng được vận chuyển từ điểm A đến điểm B
- **Telemetry**: Dữ liệu cảm biến (nhiệt độ, vị trí, độ ẩm) được thu thập từ thiết bị IoT
- **Chain_of_Custody**: Chuỗi quyền sở hữu/trách nhiệm của lô hàng qua các bên liên quan
- **Alarm_Event**: Sự kiện cảnh báo khi có vi phạm điều kiện vận chuyển
- **Port**: Cảng biển/sân bay nơi lô hàng đi qua
- **Party**: Các bên liên quan (chủ hàng, logistics, auditor)
- **Cargo_Profile**: Hồ sơ định nghĩa điều kiện vận chuyển cho từng loại hàng hóa
- **Referential_Integrity**: Tính toàn vẹn tham chiếu giữa các bảng
- **Temporal_Validity**: Tính hợp lệ theo thời gian của dữ liệu
- **Geospatial_Index**: Index cho dữ liệu địa lý (latitude, longitude)
- **TTL_Index**: Time-To-Live index tự động xóa dữ liệu cũ
- **Stored_Procedure**: Thủ tục lưu trữ trong database để thực hiện business logic
- **Trigger**: Cơ chế tự động thực thi khi có sự kiện INSERT/UPDATE/DELETE
- **View**: Bảng ảo được tạo từ query phức tạp

## Requirements

### Requirement 1: Cải Tiến Bảng Parties (MySQL)

**User Story:** Là một system administrator, tôi muốn lưu trữ đầy đủ thông tin liên hệ và trạng thái của các bên liên quan, để có thể quản lý và liên lạc hiệu quả với họ.

#### Acceptance Criteria

1. WHEN the system stores party information THEN the MySQL_Database SHALL include email address field with maximum 255 characters
2. WHEN the system stores party information THEN the MySQL_Database SHALL include phone number field with maximum 32 characters
3. WHEN the system stores party information THEN the MySQL_Database SHALL include address field with TEXT data type for unlimited length
4. WHEN the system stores party information THEN the MySQL_Database SHALL include status field with ENUM values of ACTIVE, INACTIVE, and SUSPENDED
5. WHEN a party record is modified THEN the MySQL_Database SHALL automatically update the UpdatedAtUTC timestamp field
6. WHEN querying parties by type and status THEN the MySQL_Database SHALL use composite index on PartyType and Status columns for performance optimization

### Requirement 2: Cải Tiến Bảng Ports (MySQL)

**User Story:** Là một logistics coordinator, tôi muốn có thông tin địa lý và trạng thái hoạt động của các cảng, để có thể lập kế hoạch tuyến đường và xử lý các tình huống cảng đóng cửa.

#### Acceptance Criteria

1. WHEN the system stores port information THEN the MySQL_Database SHALL include latitude field with DECIMAL(10,8) precision for accurate geolocation
2. WHEN the system stores port information THEN the MySQL_Database SHALL include longitude field with DECIMAL(11,8) precision for accurate geolocation
3. WHEN the system stores port information THEN the MySQL_Database SHALL include timezone field with VARCHAR(64) to store IANA timezone identifier
6. WHEN querying ports by country THEN the MySQL_Database SHALL use index on Country column for performance
7. WHEN querying ports by location THEN the MySQL_Database SHALL use composite index on Latitude and Longitude columns for geospatial queries

### Requirement 3: Cải Tiến Bảng CargoProfiles (MySQL)

**User Story:** Là một cargo manager, tôi muốn định nghĩa đầy đủ các điều kiện vận chuyển bao gồm nhiệt độ, độ ẩm, và thời gian tối đa, để đảm bảo chất lượng hàng hóa nhạy cảm.

#### Acceptance Criteria

1. WHEN the system stores cargo profile THEN the MySQL_Database SHALL include humidity minimum field with DECIMAL(5,2) precision for percentage values
2. WHEN the system stores cargo profile THEN the MySQL_Database SHALL include humidity maximum field with DECIMAL(5,2) precision for percentage values
3. WHEN the system stores cargo profile THEN the MySQL_Database SHALL include maximum transit hours field with INTEGER data type
4. WHEN the system stores cargo profile THEN the MySQL_Database SHALL include handling instructions field with TEXT data type
5. WHEN the system stores cargo profile THEN the MySQL_Database SHALL include requires refrigeration flag with BOOLEAN data type
6. WHEN the system stores cargo profile THEN the MySQL_Database SHALL include hazardous class field with VARCHAR(16) for UN classification
7. WHEN humidity values are provided THEN the MySQL_Database SHALL enforce CHECK constraint that HumidityMin is less than HumidityMax

### Requirement 4: Cải Tiến Bảng Shipments (MySQL)

**User Story:** Là một shipment tracker, tôi muốn có đầy đủ thông tin về khối lượng, thời gian dự kiến, giá trị bảo hiểm, và thiết bị tracking, để quản lý toàn diện lô hàng.

#### Acceptance Criteria

1. WHEN the system stores shipment information THEN the MySQL_Database SHALL include volume field with DECIMAL(10,2) for cubic meters measurement
2. WHEN the system stores shipment information THEN the MySQL_Database SHALL include estimated arrival timestamp field with TIMESTAMP(6) precision
3. WHEN the system stores shipment information THEN the MySQL_Database SHALL include actual arrival timestamp field with TIMESTAMP(6) precision
4. WHEN the system stores shipment information THEN the MySQL_Database SHALL include insurance value field with DECIMAL(15,2) for monetary amount
5. WHEN the system stores shipment information THEN the MySQL_Database SHALL include currency code field with VARCHAR(3) for ISO 4217 standard
6. WHEN the system stores shipment information THEN the MySQL_Database SHALL include tracking device ID field with VARCHAR(64) for IoT device identifier
7. WHEN the system stores shipment information THEN the MySQL_Database SHALL include container number field with VARCHAR(32) for shipping container
8. WHEN the system stores shipment information THEN the MySQL_Database SHALL include seal number field with VARCHAR(32) for tamper-evident seal
9. WHEN the system stores alarm reason THEN the MySQL_Database SHALL expand AlarmReason field from VARCHAR(64) to VARCHAR(255) for detailed messages
10. WHEN querying shipments by tracking device THEN the MySQL_Database SHALL use index on TrackingDeviceID column
11. WHEN querying shipments by container THEN the MySQL_Database SHALL use index on ContainerNumber column
12. WHEN querying shipments by estimated arrival THEN the MySQL_Database SHALL use index on EstimatedArrivalUTC column

### Requirement 5: Cải Tiến Bảng Ownership (MySQL)

**User Story:** Là một auditor, tôi muốn có bằng chứng số về việc bàn giao hàng hóa bao gồm chữ ký, tình trạng hàng, và người chứng kiến, để đảm bảo tính minh bạch trong chuỗi custody.

#### Acceptance Criteria

1. WHEN the system records ownership handover THEN the MySQL_Database SHALL include handover condition field with ENUM values of GOOD, DAMAGED, and PARTIAL
2. WHEN the system records ownership handover THEN the MySQL_Database SHALL include handover notes field with TEXT data type for detailed description
3. WHEN the system records ownership handover THEN the MySQL_Database SHALL include digital signature hash field with VARCHAR(255) for cryptographic proof
4. WHEN the system records ownership handover THEN the MySQL_Database SHALL include witness party ID field with VARCHAR(32) referencing Parties table
5. WHEN the system records ownership handover THEN the MySQL_Database SHALL include handover document URL field with VARCHAR(512) for external document link
6. WHEN witness party ID is provided THEN the MySQL_Database SHALL enforce foreign key constraint to Parties table

### Requirement 6: Cải Tiến Bảng AlarmEvents (MySQL)

**User Story:** Là một operations manager, tôi muốn theo dõi trạng thái xử lý của các cảnh báo bao gồm mức độ nghiêm trọng, người xác nhận, và ghi chú giải quyết, để quản lý incident hiệu quả.

#### Acceptance Criteria

1. WHEN the system creates alarm event THEN the MySQL_Database SHALL include severity field with ENUM values of LOW, MEDIUM, HIGH, and CRITICAL
2. WHEN the system creates alarm event THEN the MySQL_Database SHALL include status field with ENUM values of OPEN, ACKNOWLEDGED, RESOLVED, and FALSE_ALARM
3. WHEN an alarm is acknowledged THEN the MySQL_Database SHALL record acknowledged by field with VARCHAR(32) for user identifier
4. WHEN an alarm is acknowledged THEN the MySQL_Database SHALL record acknowledged timestamp field with TIMESTAMP(6) precision
5. WHEN an alarm is resolved THEN the MySQL_Database SHALL record resolved by field with VARCHAR(32) for user identifier
6. WHEN an alarm is resolved THEN the MySQL_Database SHALL record resolved timestamp field with TIMESTAMP(6) precision
7. WHEN an alarm is resolved THEN the MySQL_Database SHALL record resolution notes field with TEXT data type
8. WHEN the system stores alarm type THEN the MySQL_Database SHALL expand AlarmType ENUM to include HUMIDITY_VIOLATION, ROUTE_DEVIATION, UNAUTHORIZED_ACCESS, and DEVICE_MALFUNCTION
9. WHEN querying alarms by status and severity THEN the MySQL_Database SHALL use composite index on Status and Severity columns
10. WHEN querying alarms by acknowledger THEN the MySQL_Database SHALL use composite index on AcknowledgedBy and AcknowledgedAtUTC columns

### Requirement 7: Cải Tiến Collection telemetry_points (MongoDB)

**User Story:** Là một IoT engineer, tôi muốn lưu trữ đầy đủ dữ liệu cảm biến bao gồm độ ẩm, áp suất, pin, và tín hiệu, với validation hợp lệ và geospatial indexing, để phân tích toàn diện tình trạng lô hàng.

#### Acceptance Criteria

1. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL include device ID field in meta object for tracking device identification
2. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL include sensor type field in meta object with default value of IoT_Tracker
3. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL restructure location as GeoJSON Point object with coordinates array
4. WHEN the system validates location coordinates THEN the MongoDB_Database SHALL enforce longitude range between -180 and 180 degrees
5. WHEN the system validates location coordinates THEN the MongoDB_Database SHALL enforce latitude range between -90 and 90 degrees
6. WHEN the system validates temperature THEN the MongoDB_Database SHALL enforce range between -100 and 100 degrees Celsius
7. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL include humidity field with range validation between 0 and 100 percent
8. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL include pressure field with Number data type for atmospheric pressure
9. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL include battery level field with range validation between 0 and 100 percent
10. WHEN the system stores telemetry point THEN the MongoDB_Database SHALL include signal strength field with range validation between 0 and 100 percent
11. WHEN querying telemetry by location THEN the MongoDB_Database SHALL use 2dsphere geospatial index on location field

### Requirement 8: Cải Tiến Collection shipment_routes (MongoDB)

**User Story:** Là một route planner, tôi muốn theo dõi tuyến đường thực tế so với kế hoạch, vị trí hiện tại, và khoảng cách đã đi, để phát hiện sớm các sai lệch tuyến đường.

#### Acceptance Criteria

1. WHEN the system stores shipment route THEN the MongoDB_Database SHALL enforce origin port and destination port as required fields
2. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include planned route array with port code, sequence, and estimated arrival for each waypoint
3. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include actual route array with port code, arrival time, and departure time for each waypoint
4. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include current position as GeoJSON Point object
5. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include route status field with ENUM values of ON_SCHEDULE, DELAYED, DEVIATED, and COMPLETED
6. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include distance traveled field in kilometers with Number data type
7. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include distance remaining field in kilometers with Number data type
8. WHEN the system stores shipment route THEN the MongoDB_Database SHALL include created timestamp and updated timestamp fields
9. WHEN querying routes by ports THEN the MongoDB_Database SHALL use composite index on origin_port and destination_port fields
10. WHEN querying routes by status THEN the MongoDB_Database SHALL use index on route_status field
11. WHEN querying routes by location THEN the MongoDB_Database SHALL use 2dsphere geospatial index on current_position field
12. WHEN querying routes by recency THEN the MongoDB_Database SHALL use descending index on last_telemetry_at field

### Requirement 9: Cải Tiến Collection port_edges (MongoDB)

**User Story:** Là một analytics engineer, tôi muốn có dữ liệu thống kê đầy đủ về các tuyến đường bao gồm khoảng cách, phương sai thời gian, chi phí, và loại tuyến, để tối ưu hóa lựa chọn tuyến đường.

#### Acceptance Criteria

1. WHEN the system stores port edge THEN the MongoDB_Database SHALL include route type field with ENUM values of SEA, AIR, LAND, and MULTIMODAL
2. WHEN the system stores port edge THEN the MongoDB_Database SHALL include distance field in kilometers as required Number field
3. WHEN the system stores port edge THEN the MongoDB_Database SHALL include minimum hours field for fastest transit time
4. WHEN the system stores port edge THEN the MongoDB_Database SHALL include maximum hours field for slowest transit time
5. WHEN the system stores port edge THEN the MongoDB_Database SHALL include standard deviation hours field for time variance
6. WHEN the system stores port edge THEN the MongoDB_Database SHALL include average cost field in USD currency
7. WHEN the system stores port edge THEN the MongoDB_Database SHALL include carrier count field for number of available carriers
8. WHEN the system stores port edge THEN the MongoDB_Database SHALL include last updated timestamp field
9. WHEN the system stores port edge THEN the MongoDB_Database SHALL include is active boolean flag with default true value
10. WHEN the system validates alarm rate THEN the MongoDB_Database SHALL enforce range between 0 and 1 for percentage representation
11. WHEN querying high-risk routes THEN the MongoDB_Database SHALL use descending index on alarm_rate field
12. WHEN querying fastest routes THEN the MongoDB_Database SHALL use ascending index on avg_hours field
13. WHEN querying routes by type THEN the MongoDB_Database SHALL use index on route_type field

### Requirement 10: Tạo MySQL Triggers cho Automation

**User Story:** Là một database administrator, tôi muốn tự động hóa việc tạo alarm events và validate ownership chain thông qua triggers, để đảm bảo tính nhất quán dữ liệu mà không cần application logic.

#### Acceptance Criteria

1. WHEN a shipment status changes to ALARM THEN the MySQL_Database SHALL automatically create corresponding AlarmEvent record via trigger
2. WHEN a shipment status changes to ALARM THEN the trigger SHALL populate AlarmType, AlarmReason, AlarmAtUTC, and Source fields in AlarmEvents table
3. WHEN a new ownership record is inserted THEN the MySQL_Database SHALL validate via trigger that no overlapping ownership exists for the same shipment
4. WHEN a new ownership record is inserted with NULL EndAtUTC THEN the trigger SHALL verify that no other active ownership exists for that shipment
5. WHEN shipment telemetry data is updated THEN the MySQL_Database SHALL update LastTelemetryAtUTC field via trigger
6. WHEN alarm event is created THEN the trigger SHALL update Shipments table AlarmAtUTC and AlarmReason fields

### Requirement 11: Tạo MySQL Stored Procedures cho Business Logic

**User Story:** Là một application developer, tôi muốn sử dụng stored procedures để thực hiện các business logic phức tạp như transfer ownership và check temperature violation, để đảm bảo tính atomic và giảm network roundtrips.

#### Acceptance Criteria

1. WHEN transferring ownership THEN the MySQL_Database SHALL provide stored procedure SP_TransferOwnership that atomically closes current ownership and creates new ownership record
2. WHEN SP_TransferOwnership executes THEN the procedure SHALL accept parameters for ShipmentID, NewPartyID, HandoverLocation, HandoverPortCode, and HandoverCondition
3. WHEN SP_TransferOwnership executes THEN the procedure SHALL validate that current ownership exists and is active before transfer
4. WHEN checking temperature violation THEN the MySQL_Database SHALL provide stored procedure SP_CheckTemperatureViolation that compares telemetry temperature against cargo profile limits
5. WHEN SP_CheckTemperatureViolation executes THEN the procedure SHALL accept parameters for ShipmentID and CurrentTemperature
6. WHEN SP_CheckTemperatureViolation detects violation THEN the procedure SHALL return violation status and create alarm event
7. WHEN retrieving chain of custody THEN the MySQL_Database SHALL provide stored procedure SP_GetChainOfCustody that returns complete ownership history for a shipment
8. WHEN SP_GetChainOfCustody executes THEN the procedure SHALL return ordered list of ownership records with party details and handover information

### Requirement 12: Tạo MySQL Views cho Complex Queries

**User Story:** Là một business analyst, tôi muốn có views để truy vấn dễ dàng các thông tin phức tạp như active shipments with owner, alarm summary, và journey timeline, để tạo báo cáo nhanh chóng.

#### Acceptance Criteria

1. WHEN querying active shipments THEN the MySQL_Database SHALL provide view v_active_shipments_with_owner that joins Shipments, Ownership, and Parties tables
2. WHEN querying v_active_shipments_with_owner THEN the view SHALL include shipment details, current owner information, and current location
3. WHEN querying v_active_shipments_with_owner THEN the view SHALL filter only shipments with Status not equal to COMPLETED
4. WHEN analyzing alarms THEN the MySQL_Database SHALL provide view v_alarm_summary_by_cargo_type that aggregates alarm statistics by cargo type
5. WHEN querying v_alarm_summary_by_cargo_type THEN the view SHALL include total alarms, alarm types breakdown, and average resolution time
6. WHEN tracking shipment journey THEN the MySQL_Database SHALL provide view v_shipment_journey_timeline that combines shipment, ownership, and alarm events in chronological order
7. WHEN querying v_shipment_journey_timeline THEN the view SHALL include event type, timestamp, party involved, and location for each event

### Requirement 13: Implement Cross-Database Synchronization

**User Story:** Là một system architect, tôi muốn có cơ chế đồng bộ dữ liệu giữa MySQL và MongoDB, để đảm bảo tính nhất quán của thông tin shipment và telemetry trên cả hai hệ thống.

#### Acceptance Criteria

1. WHEN telemetry data is inserted in MongoDB THEN the system SHALL update Shipments.LastTelemetryAtUTC field in MySQL_Database
2. WHEN temperature violation is detected in MongoDB THEN the system SHALL create AlarmEvent record in MySQL_Database
3. WHEN shipment is created in MySQL THEN the system SHALL create corresponding shipment_routes document in MongoDB_Database
4. WHEN shipment status changes in MySQL THEN the system SHALL update route_status field in MongoDB shipment_routes collection
5. WHEN synchronization fails THEN the system SHALL log error and retry with exponential backoff strategy
6. WHEN synchronization succeeds THEN the system SHALL record sync timestamp for audit trail

### Requirement 14: Add Application-Level Validation for MongoDB

**User Story:** Là một data quality engineer, tôi muốn có validation ở application level để đảm bảo referential integrity giữa MongoDB và MySQL, vì MongoDB không hỗ trợ foreign key constraints.

#### Acceptance Criteria

1. WHEN inserting shipment_routes document THEN the system SHALL validate that shipment_id exists in MySQL Shipments table
2. WHEN inserting telemetry_points document THEN the system SHALL validate that shipment_id exists in MySQL Shipments table
3. WHEN inserting port_edges document THEN the system SHALL validate that from_port and to_port exist in MySQL Ports table
4. WHEN validation fails THEN the system SHALL reject the operation and return descriptive error message
5. WHEN validation succeeds THEN the system SHALL proceed with insert operation
6. WHEN validation is performed THEN the system SHALL cache validation results for performance optimization with TTL of 5 minutes

### Requirement 15: Implement MongoDB Change Streams for Real-time Monitoring

**User Story:** Là một monitoring engineer, tôi muốn sử dụng MongoDB Change Streams để theo dõi real-time các thay đổi trong telemetry data và tự động trigger alerts, để phản ứng nhanh với các vi phạm.

#### Acceptance Criteria

1. WHEN telemetry_points collection receives new document THEN the system SHALL detect change via Change Stream
2. WHEN temperature value exceeds cargo profile limits THEN the Change Stream handler SHALL create telemetry_logs entry with TEMP_ALERT event type
3. WHEN temperature value exceeds cargo profile limits THEN the Change Stream handler SHALL trigger MySQL alarm event creation
4. WHEN battery level falls below 20 percent THEN the Change Stream handler SHALL create telemetry_logs entry with BATTERY_LOW event type
5. WHEN connectivity is lost for more than 30 minutes THEN the Change Stream handler SHALL create telemetry_logs entry with CONNECTIVITY_LOST event type
6. WHEN Change Stream handler fails THEN the system SHALL log error and continue processing subsequent changes

### Requirement 16: Add Audit Log Table for Compliance

**User Story:** Là một compliance officer, tôi muốn có audit log table để theo dõi tất cả các thay đổi dữ liệu quan trọng, để đáp ứng yêu cầu audit và điều tra incident.

#### Acceptance Criteria

1. WHEN critical data is modified THEN the MySQL_Database SHALL record change in AuditLog table
2. WHEN recording audit log THEN the system SHALL capture table name, operation type, record ID, old value, new value, changed by user, and timestamp
3. WHEN recording audit log THEN the system SHALL store old value and new value as JSON format for flexible structure
4. WHEN querying audit logs THEN the MySQL_Database SHALL use index on TableName and ChangedAtUTC columns
5. WHEN querying audit logs THEN the MySQL_Database SHALL use index on ChangedBy column for user activity tracking
6. WHEN audit log table grows large THEN the system SHALL support partitioning by ChangedAtUTC for performance

### Requirement 17: Implement Database Backup and Recovery Strategy

**User Story:** Là một database administrator, tôi muốn có automated backup strategy cho cả MySQL và MongoDB, để đảm bảo khả năng phục hồi dữ liệu trong trường hợp disaster.

#### Acceptance Criteria

1. WHEN backup schedule runs THEN the system SHALL create full backup of MySQL_Database daily at 2 AM UTC
2. WHEN backup schedule runs THEN the system SHALL create incremental backup of MySQL_Database every 6 hours
3. WHEN backup schedule runs THEN the system SHALL create full backup of MongoDB_Database daily at 3 AM UTC
4. WHEN backup is created THEN the system SHALL verify backup integrity by performing test restore
5. WHEN backup is created THEN the system SHALL store backup files in remote storage with encryption
6. WHEN backup retention policy applies THEN the system SHALL keep daily backups for 30 days and monthly backups for 1 year
7. WHEN point-in-time recovery is needed THEN the system SHALL support restore to any point within retention period using binary logs and oplog

### Requirement 18: Add Performance Monitoring and Query Optimization

**User Story:** Là một performance engineer, tôi muốn có monitoring cho slow queries và database metrics, để identify và optimize các performance bottlenecks.

#### Acceptance Criteria

1. WHEN query execution time exceeds 1 second THEN the MySQL_Database SHALL log query to slow query log
2. WHEN slow query is logged THEN the system SHALL include execution time, rows examined, rows returned, and query text
3. WHEN analyzing slow queries THEN the system SHALL provide EXPLAIN ANALYZE output for optimization recommendations
4. WHEN monitoring database THEN the system SHALL collect metrics for connection pool usage, query throughput, and cache hit ratio
5. WHEN monitoring database THEN the system SHALL collect metrics for disk I/O, memory usage, and CPU utilization
6. WHEN metric threshold is exceeded THEN the system SHALL send alert notification to operations team
7. WHEN query optimization is needed THEN the system SHALL suggest missing indexes based on query patterns

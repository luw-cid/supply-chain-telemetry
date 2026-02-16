db = db.getSiblingDB("supply_chain")

db.telemetry_points.drop();
db.shipment_routes.drop();
db.port_edges.drop();

db.createCollection("telemetry_points", {
    timeseries: {
        timeField: "t",
        metaField: "meta",
        granularity: "seconds"
    },
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["meta", "t", "lat", "lng", "temp"],
            properties: {
                meta: {
                    bsonType: "object",
                    required: ["shipment_id"],
                    properties: {
                        shipment_id: {
                            bsonType: "string"
                        }
                    }
                },
                t: {
                    bsonType: "date"
                },
                lat: {
                    bsonType: "number"
                },
                lng: {
                    bsonType: "number"
                },
                temp: {
                    bsonType: "number"
                }
            }
        }
    }
});

db.telemetry_points.createIndex({ "meta.shipment_id": 1, "t": 1 });

db.createCollection("shipment_routes", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["shipment_id"],
            properties: {
                shipment_id: {
                    bsonType: "string"
                },
                origin_port: {
                    bsonType: "string"
                },
                destination_port: {
                    bsonType: "string"
                },
                last_telemetry_at: {
                    bsonType: "date"
                }
            }
        }
    }
});

db.shipment_routes.createIndex({ shipment_id: 1 }, { unique: true });

db.createCollection("port_edges", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["from_port", "to_port", "avg_hours", "samples", "alarm_rate"],
            properties: {
                from_port: {
                    bsonType: "string"
                },
                to_port: {
                    bsonType: "string"
                },
                avg_hours: {
                    bsonType: "number"
                },
                samples: {
                    bsonType: "int"
                },
                alarm_rate: {
                    bsonType: "number"
                }
            }
        }
    }
});

db.port_edges.createIndex({ from_port: 1, to_port: 1 }, { unique: true });

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.database import SessionLocal, Base, engine

def seed_database(db: Session = None):
    close_at_end = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_at_end = True

    try:
        # 1. Maintenance Types
        types_data = [
            {"code": "PREVENTATIVE", "name": "Preventative Maintenance", "description": "Scheduled proactive inspection and servicing.", "is_emergency": False},
            {"code": "CORRECTIVE", "name": "Corrective Repair", "description": "Repair of degraded or broken components during normal operations.", "is_emergency": False},
            {"code": "EMERGENCY", "name": "Emergency Breakdown", "description": "Critical unplanned stoppage requiring immediate technician dispatch.", "is_emergency": True},
            {"code": "INSPECTION", "name": "Safety & Compliance Inspection", "description": "Regulatory and insurance safety validation.", "is_emergency": False},
            {"code": "CALIBRATION", "name": "Precision Calibration", "description": "Sensor and actuator tolerance calibration.", "is_emergency": False},
        ]
        
        maint_types = {}
        for td in types_data:
            existing = db.query(MaintenanceType).filter(MaintenanceType.code == td["code"]).first()
            if not existing:
                mt = MaintenanceType(**td)
                db.add(mt)
                db.flush()
                maint_types[td["code"]] = mt
            else:
                maint_types[td["code"]] = existing

        # 2. Technicians
        techs_data = [
            {"employee_id": "TECH-101", "name": "Marcus Vance", "email": "m.vance@maintainiq.internal", "phone": "+1 (555) 234-8901", "specialization": "HVAC & Thermal", "status": "ACTIVE", "hourly_rate": 65.0},
            {"employee_id": "TECH-102", "name": "Elena Rostova", "email": "e.rostova@maintainiq.internal", "phone": "+1 (555) 345-9012", "specialization": "Robotics & Automation", "status": "ACTIVE", "hourly_rate": 78.0},
            {"employee_id": "TECH-103", "name": "Devon Cole", "email": "d.cole@maintainiq.internal", "phone": "+1 (555) 456-0123", "specialization": "Electrical & High-Voltage", "status": "ACTIVE", "hourly_rate": 72.0},
            {"employee_id": "TECH-104", "name": "Sophia Zhang", "email": "s.zhang@maintainiq.internal", "phone": "+1 (555) 567-1234", "specialization": "Hydraulics & Mechanical", "status": "ACTIVE", "hourly_rate": 68.0},
            {"employee_id": "TECH-105", "name": "Liam Gallagher", "email": "l.gallagher@maintainiq.internal", "phone": "+1 (555) 678-2345", "specialization": "Precision Calibration", "status": "ON_LEAVE", "hourly_rate": 70.0},
        ]
        
        technicians = {}
        for td in techs_data:
            existing = db.query(Technician).filter(Technician.employee_id == td["employee_id"]).first()
            if not existing:
                t = Technician(**td)
                db.add(t)
                db.flush()
                technicians[td["employee_id"]] = t
            else:
                technicians[td["employee_id"]] = existing

        # 3. Assets
        assets_data = [
            {
                "asset_tag": "AST-0101",
                "name": "5-Axis CNC Milling Center",
                "category": "CNC Machinery",
                "location": "Fabrication Plant A - Bay 1",
                "status": "OPERATIONAL",
                "serial_number": "HAAS-VF5-2023-99",
                "manufacturer": "Haas Automation",
                "model_number": "VF-5/40XT",
                "criticality": "HIGH",
                "notes": "Primary aluminum impeller milling unit. Requires tight spindle tolerances."
            },
            {
                "asset_tag": "AST-0102",
                "name": "Industrial Steam Boiler 600BHP",
                "category": "Thermal & Energy",
                "location": "Central Utility Building - Room 104",
                "status": "OPERATIONAL",
                "serial_number": "CB-CBL-600-08",
                "manufacturer": "Cleaver-Brooks",
                "model_number": "CBL-700-600",
                "criticality": "CRITICAL",
                "notes": "Provides high pressure process steam for sterilization and heating."
            },
            {
                "asset_tag": "AST-0103",
                "name": "Centrifugal Water Chiller 450T",
                "category": "HVAC",
                "location": "Roof Deck - Mechanical Penthouse",
                "status": "UNDER_MAINTENANCE",
                "serial_number": "TR-CTV-450-2021",
                "manufacturer": "Trane",
                "model_number": "CTV-E450",
                "criticality": "HIGH",
                "notes": "Chilled water circulation for cleanroom zone B."
            },
            {
                "asset_tag": "AST-0104",
                "name": "Heavy Hydraulic Stamping Press 500T",
                "category": "Hydraulics",
                "location": "Press Shop - Line 3",
                "status": "OUT_OF_SERVICE",
                "serial_number": "KOM-H2P-500-19",
                "manufacturer": "Komatsu",
                "model_number": "H2P-500",
                "criticality": "CRITICAL",
                "notes": "Main hydraulic cylinder seal blew on morning shift. Strictly offline until rebuilt."
            },
            {
                "asset_tag": "AST-0105",
                "name": "Robotic Spot Welding Cell #4",
                "category": "Robotics",
                "location": "Assembly Hall 2 - Station 14",
                "status": "OPERATIONAL",
                "serial_number": "KUKA-KR210-R3100",
                "manufacturer": "KUKA Robotics",
                "model_number": "KR Quantec",
                "criticality": "HIGH",
                "notes": "Dual arm spot welder. Calibrated last month."
            },
            {
                "asset_tag": "AST-0106",
                "name": "Main Air Compressor Rotary Screw 75HP",
                "category": "Pneumatics",
                "location": "Utility Room B",
                "status": "OPERATIONAL",
                "serial_number": "IR-N75-2022",
                "manufacturer": "Ingersoll Rand",
                "model_number": "Nirvana 75",
                "criticality": "MEDIUM",
                "notes": "Feeds plant pneumatic tooling at 125 PSI."
            }
        ]

        assets = {}
        for ad in assets_data:
            existing = db.query(Asset).filter(Asset.asset_tag == ad["asset_tag"]).first()
            if not existing:
                a = Asset(**ad)
                db.add(a)
                db.flush()
                assets[ad["asset_tag"]] = a
            else:
                assets[ad["asset_tag"]] = existing

        # 4. Work Orders with Realistic Audit Trails
        now = datetime.utcnow()
        
        # Check if work orders already seeded
        if db.query(WorkOrder).count() == 0:
            # WO 1: In Progress Corrective repair on Chiller
            wo1 = WorkOrder(
                work_order_number="WO-2026-0001",
                title="Secondary Refrigerant Loop Pressure Drop",
                description="Sensors reporting 18% below baseline suction pressure on Circuit 2. Investigate potential flare fitting leak and purge valves.",
                asset_id=assets["AST-0103"].id,
                maintenance_type_id=maint_types["CORRECTIVE"].id,
                priority="HIGH",
                status="IN_PROGRESS",
                assigned_technician_id=technicians["TECH-101"].id,
                scheduled_date=now + timedelta(hours=2),
                estimated_hours=4.0,
                created_at=now - timedelta(days=1, hours=3),
                updated_at=now - timedelta(hours=1)
            )
            db.add(wo1)
            db.flush()

            db.add(WorkOrderStatusHistory(
                work_order_id=wo1.id,
                from_status=None,
                to_status="OPEN",
                changed_by="Automated SCADA Alert",
                notes="Diagnostic threshold triggered by telemetry monitor.",
                created_at=now - timedelta(days=1, hours=3)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo1.id,
                from_status="OPEN",
                to_status="ASSIGNED",
                changed_by="Dispatcher Sarah Connor",
                notes="Assigned to HVAC Lead Marcus Vance.",
                created_at=now - timedelta(days=1, hours=1)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo1.id,
                from_status="ASSIGNED",
                to_status="IN_PROGRESS",
                changed_by="Marcus Vance",
                notes="Began pressure testing loop with nitrogen tracer gas.",
                created_at=now - timedelta(hours=1)
            ))

            # WO 2: Open Preventative on CNC Milling Center
            wo2 = WorkOrder(
                work_order_number="WO-2026-0002",
                title="Quarterly Spindle Taper & Way-Lube Inspection",
                description="Measure runout with dial test indicator, clean way lube filtration mesh, and verify Z-axis counterweight pneumatic pressure.",
                asset_id=assets["AST-0101"].id,
                maintenance_type_id=maint_types["PREVENTATIVE"].id,
                priority="MEDIUM",
                status="OPEN",
                assigned_technician_id=None,
                scheduled_date=now + timedelta(days=2),
                estimated_hours=3.5,
                created_at=now - timedelta(hours=18),
                updated_at=now - timedelta(hours=18)
            )
            db.add(wo2)
            db.flush()
            db.add(WorkOrderStatusHistory(
                work_order_id=wo2.id,
                from_status=None,
                to_status="OPEN",
                changed_by="PM Scheduler Engine",
                notes="Generated from 90-day recurring preventative maintenance schedule.",
                created_at=now - timedelta(hours=18)
            ))

            # WO 3: Assigned High Priority on Spot Welder
            wo3 = WorkOrder(
                work_order_number="WO-2026-0003",
                title="Electrode Tip Dresser Sensor Alignment",
                description="Electrode tip wear detector is misaligned by 3mm causing false alert stoppages during line shifts.",
                asset_id=assets["AST-0105"].id,
                maintenance_type_id=maint_types["CORRECTIVE"].id,
                priority="HIGH",
                status="ASSIGNED",
                assigned_technician_id=technicians["TECH-102"].id,
                scheduled_date=now + timedelta(hours=6),
                estimated_hours=2.0,
                created_at=now - timedelta(hours=8),
                updated_at=now - timedelta(hours=5)
            )
            db.add(wo3)
            db.flush()
            db.add(WorkOrderStatusHistory(
                work_order_id=wo3.id,
                from_status=None,
                to_status="OPEN",
                changed_by="Line Supervisor Alex Vance",
                notes="Logged after second shift reported intermittent weld faults.",
                created_at=now - timedelta(hours=8)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo3.id,
                from_status="OPEN",
                to_status="ASSIGNED",
                changed_by="Dispatcher Sarah Connor",
                notes="Dispatched Elena Rostova (Robotics Specialist).",
                created_at=now - timedelta(hours=5)
            ))

            # WO 4: Completed Calibration on Boiler
            wo4 = WorkOrder(
                work_order_number="WO-2026-0004",
                title="Pressure Relief Valve Annual Hydrostatic Certification",
                description="Perform live pop test on ASME Section I safety valves and verify flame safeguard timing sequence.",
                asset_id=assets["AST-0102"].id,
                maintenance_type_id=maint_types["CALIBRATION"].id,
                priority="HIGH",
                status="COMPLETED",
                assigned_technician_id=technicians["TECH-103"].id,
                scheduled_date=now - timedelta(days=2),
                estimated_hours=4.0,
                actual_hours=3.75,
                resolution_summary="Both safety valves tested at 150 PSI setpoint with clean lift and reseat within 4% blowdown. State certification tags stamped and updated.",
                created_at=now - timedelta(days=4),
                updated_at=now - timedelta(days=2)
            )
            db.add(wo4)
            db.flush()
            db.add(WorkOrderStatusHistory(
                work_order_id=wo4.id,
                from_status=None,
                to_status="OPEN",
                changed_by="Compliance Officer",
                notes="State boiler safety inspection due.",
                created_at=now - timedelta(days=4)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo4.id,
                from_status="OPEN",
                to_status="ASSIGNED",
                changed_by="Dispatcher Sarah Connor",
                notes="Assigned Devon Cole (Senior Electrical & Safety Inspector).",
                created_at=now - timedelta(days=3)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo4.id,
                from_status="ASSIGNED",
                to_status="IN_PROGRESS",
                changed_by="Devon Cole",
                notes="Boiler isolated and hydrostatic testing rig engaged.",
                created_at=now - timedelta(days=2, hours=4)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo4.id,
                from_status="IN_PROGRESS",
                to_status="COMPLETED",
                changed_by="Devon Cole",
                notes="Test certified compliant. Reconnected main steam header.",
                created_at=now - timedelta(days=2)
            ))

            # WO 5: Cancelled Work Order
            wo5 = WorkOrder(
                work_order_number="WO-2026-0005",
                title="Air Compressor Desiccant Dryer Replacement",
                description="Routine desiccant cartridge change initially requested based on calendar schedule.",
                asset_id=assets["AST-0106"].id,
                maintenance_type_id=maint_types["PREVENTATIVE"].id,
                priority="LOW",
                status="CANCELLED",
                assigned_technician_id=technicians["TECH-104"].id,
                scheduled_date=now - timedelta(days=3),
                estimated_hours=1.5,
                cancellation_reason="Moisture dewpoint analyzer reads -40°C; desiccant media was changed during preceding overhaul 2 weeks ago.",
                created_at=now - timedelta(days=5),
                updated_at=now - timedelta(days=3)
            )
            db.add(wo5)
            db.flush()
            db.add(WorkOrderStatusHistory(
                work_order_id=wo5.id,
                from_status=None,
                to_status="OPEN",
                changed_by="Automated PM Dispatcher",
                notes="Generated from calendar batch.",
                created_at=now - timedelta(days=5)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo5.id,
                from_status="OPEN",
                to_status="ASSIGNED",
                changed_by="Dispatcher",
                notes="Assigned to Sophia Zhang.",
                created_at=now - timedelta(days=4)
            ))
            db.add(WorkOrderStatusHistory(
                work_order_id=wo5.id,
                from_status="ASSIGNED",
                to_status="CANCELLED",
                changed_by="Sophia Zhang",
                notes="Cancelled due to recent replacement during overhaul.",
                created_at=now - timedelta(days=3)
            ))

            # WO 6: CRITICAL Emergency on the Out-of-Service Stamping Press!
            wo6 = WorkOrder(
                work_order_number="WO-2026-0006",
                title="Emergency Hydraulic Ram Seal Replacement & Bladder Flush",
                description="Main 500-ton ram cylinder seal blown. Fluid containment initiated. Immediate rebuild required to prevent press frame deformation.",
                asset_id=assets["AST-0104"].id,
                maintenance_type_id=maint_types["EMERGENCY"].id,
                priority="CRITICAL",
                status="ASSIGNED",
                assigned_technician_id=technicians["TECH-104"].id,
                scheduled_date=now + timedelta(hours=1),
                estimated_hours=8.0,
                created_at=now - timedelta(hours=2),
                updated_at=now - timedelta(hours=1)
            )
            db.add(wo6)
            db.flush()
            db.add(WorkOrderStatusHistory(
                work_order_id=wo6.id,
                from_status=None,
                to_status="ASSIGNED",
                changed_by="Emergency Hotline Dispatch",
                notes="Emergency ticket created with Sophia Zhang dispatched immediately.",
                created_at=now - timedelta(hours=2)
            ))

        db.commit()
        print("Database successfully seeded with realistic maintenance operations data.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        if close_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()

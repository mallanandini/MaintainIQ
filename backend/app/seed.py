from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType
from backend.app.models.work_order import WorkOrder, WorkOrderStatusHistory
from backend.app.models.checklist import (
    ChecklistTemplate,
    ChecklistTemplateItem,
    WorkOrderChecklist,
    WorkOrderChecklistItem
)
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
                "operating_hours": 4850.0,
                "service_threshold_hours": 5000.0,
                "operating_cycles": 9600,
                "service_threshold_cycles": 10000,
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
                "operating_hours": 8200.0,
                "service_threshold_hours": 8000.0,
                "operating_cycles": 16500,
                "service_threshold_cycles": 15000,
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
                "operating_hours": 3100.0,
                "service_threshold_hours": 4000.0,
                "operating_cycles": 6200,
                "service_threshold_cycles": 8000,
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
                "operating_hours": 5400.0,
                "service_threshold_hours": 5000.0,
                "operating_cycles": 11000,
                "service_threshold_cycles": 10000,
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
                "operating_hours": 1200.0,
                "service_threshold_hours": 5000.0,
                "operating_cycles": 2400,
                "service_threshold_cycles": 10000,
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
                "operating_hours": 2100.0,
                "service_threshold_hours": 4500.0,
                "operating_cycles": 4200,
                "service_threshold_cycles": 9000,
                "notes": "Feeds plant pneumatic tooling at 125 PSI."
            },
            {
                "asset_tag": "AST-0107",
                "name": "Auxiliary Staging Conveyor",
                "category": "Material Handling",
                "location": "Warehouse C - Staging Dock",
                "status": "OPERATIONAL",
                "serial_number": "DODGE-TR-2024",
                "manufacturer": "Dodge Industrial",
                "model_number": "Torq-500",
                "criticality": "LOW",
                "operating_hours": None,
                "operating_cycles": None,
                "service_threshold_hours": None,
                "service_threshold_cycles": None,
                "notes": "Newly installed auxiliary conveyor awaiting telemetry integration. No baseline data yet."
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
                for k, v in ad.items():
                    if getattr(existing, k, None) is None:
                        setattr(existing, k, v)
                db.flush()
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
            db.add(WorkOrderStatusHistory(
                work_order_id=wo6.id,
                from_status=None,
                to_status="ASSIGNED",
                changed_by="Emergency Hotline Dispatch",
                notes="Emergency ticket created with Sophia Zhang dispatched immediately.",
                created_at=now - timedelta(hours=2)
            ))

        # 5. Inspection Checklist Templates
        templates_data = [
            {
                "title": "HVAC Chiller & Refrigeration Loop Inspection",
                "description": "Standard diagnostic and preventative verification for chillers, condensers, and thermal exchange systems.",
                "asset_category": "HVAC",
                "maintenance_type_code": "CORRECTIVE",
                "items": [
                    ("Refrigerant Loop Suction & Discharge Pressure", "Check gauges against operating design curve (nominal 65 PSI suction)", True),
                    ("Condenser Coils & Fin Matrix Condition", "Inspect for debris fouling, corrosion, and air restriction", True),
                    ("Compressor Vibration & Mounting Damper Integrity", "Measure harmonic vibration levels and examine rubber isolators", False),
                    ("Expansion Valve & Solenoid Control Response", "Confirm smooth modulation and zero stickiness under cycling load", True),
                    ("Refrigerant Tracer Gas Leak Detection", "Perform electronic halogen or nitrogen bubble test on high-stress joints", True),
                ]
            },
            {
                "title": "High-Pressure Hydraulic Stamping Press Safety Inspection",
                "description": "Critical integrity and safety verification for 500T+ stamping presses and hydraulic power units.",
                "asset_category": "Hydraulics",
                "maintenance_type_code": "EMERGENCY",
                "items": [
                    ("Main Hydraulic Ram Rod & Chevron Packing Seals", "Examine cylinder rod for scoring, chrome peeling, and oil weepage", True),
                    ("Proportional Relief Valve Pop-Off Setting", "Verify relief pressure cuts out at 3000 PSI maximum limit", True),
                    ("Emergency Dual-Hand Anti-Tie-Down Control & Light Curtains", "Perform physical test of optical curtain cutoff response (<20ms)", True),
                    ("Reservoir Oil Level, Temperature & Filter Delta-P", "Verify fluid clarity, temperature under 55C, and filter indicator in green", True),
                    ("Flexible Hydraulic Hose Crimps & Bend Radii", "Inspect high-pressure braided lines for bulging, scuffing, or kinking", False),
                ]
            },
            {
                "title": "Industrial Boiler & Steam Vessel Safety Certification",
                "description": "Annual regulatory inspection and safeguard timing test for high-pressure steam boilers.",
                "asset_category": "Thermal & Energy",
                "maintenance_type_code": "CALIBRATION",
                "items": [
                    ("ASME Section I Safety Relief Valve Pop & Reseat Test", "Perform hydrostatic lift test to verify rated setpoint pop-off", True),
                    ("Burner Flame Safeguard Ultraviolet Scanner Calibration", "Measure flame signal strength (minimum 4.0 VDC) and verify quick cutoff", True),
                    ("Low-Water Cutoff (LWCO) Float Chamber Blowdown", "Confirm automatic fuel shutoff trips when float chamber water is evacuated", True),
                    ("Forced Draft Damper Actuator & Air/Fuel Ratio Linkage", "Inspect linkage play, zero hysteresis, and verify smooth modulation", False),
                ]
            },
            {
                "title": "CNC Machining Center Spindle & Axis Way-Lube Inspection",
                "description": "Precision alignment and preventative lubrication verification for 5-axis CNC machining centers.",
                "asset_category": "CNC Machinery",
                "maintenance_type_code": "PREVENTATIVE",
                "items": [
                    ("Spindle Taper Runout & Drawbar Retention Force", "Verify runout under 0.003mm using 300mm precision test bar", True),
                    ("Way Lube Metering Unit & Pneumatic Pressure", "Inspect pump displacement and clear any blockage in distribution blocks", True),
                    ("X/Y/Z Axis Telescopic Way Cover Wiper Seals", "Check rubber wipers for tear, chip accumulation, and binding", True),
                    ("Coolant Concentration & Refractometer Brix Value", "Measure water-soluble coolant emulsion (target 7.5% - 9.0%)", False),
                ]
            },
            {
                "title": "General Facility & Mechanical Baseline Safety Checklist",
                "description": "Standard multi-point safety and mechanical baseline check for all manufacturing equipment.",
                "asset_category": "General",
                "maintenance_type_code": None,
                "items": [
                    ("Emergency Stop Pushbuttons & Safety Interlocks", "Verify all E-stops cut power cleanly and latch until manually reset", True),
                    ("Electrical Enclosure, Grounding & Cable Protection", "Inspect conduit, cable glands, and verify earth grounding continuity", True),
                    ("Moving Parts Guarding & Pinch Point Shields", "Ensure fixed and interlocking guards are secured in place", True),
                    ("Operating Clearance & Housekeeping Perimeter", "Check 1-meter service clearance is free of tripping hazards and oil spills", False),
                ]
            }
        ]

        seeded_templates = {}
        for td in templates_data:
            existing_tmpl = db.query(ChecklistTemplate).filter(ChecklistTemplate.title == td["title"]).first()
            mt_id = maint_types[td["maintenance_type_code"]].id if td["maintenance_type_code"] and td["maintenance_type_code"] in maint_types else None
            if not existing_tmpl:
                tmpl = ChecklistTemplate(
                    title=td["title"],
                    description=td["description"],
                    asset_category=td["asset_category"],
                    maintenance_type_id=mt_id,
                    is_active=True
                )
                db.add(tmpl)
                db.flush()
                for idx, (txt, desc, req) in enumerate(td["items"], start=1):
                    item = ChecklistTemplateItem(
                        template_id=tmpl.id,
                        order_index=idx,
                        item_text=txt,
                        description=desc,
                        is_required=req
                    )
                    db.add(item)
                db.flush()
                seeded_templates[td["title"]] = tmpl
            else:
                seeded_templates[td["title"]] = existing_tmpl

        # 6. Seed active checklist on WO-2026-0001 (In Progress Chiller) if none exists
        wo1_obj = db.query(WorkOrder).filter(WorkOrder.work_order_number == "WO-2026-0001").first()
        if wo1_obj and not wo1_obj.checklist:
            hvac_tmpl = seeded_templates.get("HVAC Chiller & Refrigeration Loop Inspection")
            wo1_cl = WorkOrderChecklist(
                work_order_id=wo1_obj.id,
                template_id=hvac_tmpl.id if hvac_tmpl else None,
                title="HVAC Chiller & Refrigeration Loop Inspection",
                summary_notes="Inspection in progress. Detected refrigerant circuit micro-leakage on manifold header."
            )
            db.add(wo1_cl)
            db.flush()
            if hvac_tmpl and hvac_tmpl.items:
                statuses = ["PASS", "PASS", "PASS", "PASS", "FAIL"]
                notes_list = [
                    "Suction pressure verified at 64.5 PSI (within 2% tolerance).",
                    "Condenser matrix clean; minimal dust accumulation.",
                    "Vibration within ISO 10816 class II velocity tolerances (1.8 mm/s).",
                    "Electronic TXV responded instantaneously to 5V test signal.",
                    "Nitrogen bubble test confirmed pinhole leak on Circuit 2 high-side flare nut."
                ]
                for idx, t_item in enumerate(hvac_tmpl.items):
                    db.add(WorkOrderChecklistItem(
                        checklist_id=wo1_cl.id,
                        order_index=t_item.order_index,
                        item_text=t_item.item_text,
                        description=t_item.description,
                        is_required=t_item.is_required,
                        status=statuses[idx % len(statuses)],
                        notes=notes_list[idx % len(notes_list)],
                        inspected_at=now - timedelta(hours=1),
                        inspected_by="Marcus Vance"
                    ))

        # 7. Seed completed checklist on WO-2026-0004 (Completed Boiler) if none exists
        wo4_obj = db.query(WorkOrder).filter(WorkOrder.work_order_number == "WO-2026-0004").first()
        if wo4_obj and not wo4_obj.checklist:
            boiler_tmpl = seeded_templates.get("Industrial Boiler & Steam Vessel Safety Certification")
            wo4_cl = WorkOrderChecklist(
                work_order_id=wo4_obj.id,
                template_id=boiler_tmpl.id if boiler_tmpl else None,
                title="Industrial Boiler & Steam Vessel Safety Certification",
                summary_notes="All hydrostatic safety thresholds and safety relief valve settings verified in compliance with ASME Section I.",
                completed_at=now - timedelta(days=2),
                completed_by="Devon Cole"
            )
            db.add(wo4_cl)
            db.flush()
            if boiler_tmpl and boiler_tmpl.items:
                pass_notes = [
                    "Valves popped precisely at 150.2 PSI; reseated cleanly without chatter at 144.1 PSI.",
                    "UV scanner signal 4.8 VDC; flame loss safety interlock responded in 1.4 seconds (limit 4.0s).",
                    "Low water cutoff float evacuated; burner relay cut in 0.8 seconds.",
                    "Air damper stroke inspected; zero backlash observed across 0-100% modulation range."
                ]
                for idx, t_item in enumerate(boiler_tmpl.items):
                    db.add(WorkOrderChecklistItem(
                        checklist_id=wo4_cl.id,
                        order_index=t_item.order_index,
                        item_text=t_item.item_text,
                        description=t_item.description,
                        is_required=t_item.is_required,
                        status="PASS",
                        notes=pass_notes[idx % len(pass_notes)],
                        inspected_at=now - timedelta(days=2, hours=1),
                        inspected_by="Devon Cole"
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

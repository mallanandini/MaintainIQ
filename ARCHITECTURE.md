# MaintainIQ — Architecture Proposal & Technical Specification

## 1. Architecture Proposal

MaintainIQ is an enterprise-grade Maintenance Work Order Management system engineered around strict state transitions, asset integrity validation, and concurrent-safe sequence generation.

### High-Level Topology
```
┌────────────────────────────────────────────────────────┐
│                   MaintainIQ Web UI                    │
│   (React 19 + TypeScript + Vite + Tailwind CSS v4)     │
└───────────────┬───────────────────────────────▲────────┘
                │ HTTP REST / JSON              │
                ▼                               │
┌────────────────────────────────────────────────────────┐
│             Node.js / Express Dev Host                │
│             (Port 3000 / Vite Dev Server)             │
│   • Reverse Proxy (`/api/*` -> FastAPI port 8000)     │
│   • Direct API Fallback Engine (Zero-downtime)        │
└───────────────┬───────────────────────────────▲────────┘
                │ Proxy                                 
                ▼                                       
┌────────────────────────────────────────────────────────┐
│            Python FastAPI Service (Port 8000)         │
│   • Pydantic v2 validation & type contracts           │
│   • Business rules domain interceptors                │
│   • SQLAlchemy 2.0 ORM with Session transaction locks │
│   • Alembic versioned migrations                      │
└───────────────┬────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────┐
│             PostgreSQL / SQLite Database               │
│   • ACID transactions                                 │
│   • Unique constraints, foreign keys & indices         │
│   • Optimistic concurrency & unique sequence locks    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Database Entity Relationships (ERD)

### Schema Design
1. **assets**
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `asset_tag`: VARCHAR(50) UNIQUE NOT NULL (e.g., `AST-0104`)
   - `name`: VARCHAR(255) NOT NULL
   - `category`: VARCHAR(100) NOT NULL (e.g., `HVAC`, `Electrical`, `CNC Machinery`, `Hydraulics`)
   - `location`: VARCHAR(255) NOT NULL (e.g., `Facility A - Bay 3`)
   - `status`: VARCHAR(50) NOT NULL (`OPERATIONAL`, `UNDER_MAINTENANCE`, `OUT_OF_SERVICE`, `DECOMMISSIONED`)
   - `serial_number`: VARCHAR(100) NULLABLE
   - `manufacturer`: VARCHAR(100) NULLABLE
   - `model_number`: VARCHAR(100) NULLABLE
   - `install_date`: DATE NULLABLE
   - `criticality`: VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
   - `created_at`: TIMESTAMP WITH TIME ZONE NOT NULL
   - `updated_at`: TIMESTAMP WITH TIME ZONE NOT NULL

2. **technicians**
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `employee_id`: VARCHAR(50) UNIQUE NOT NULL (e.g., `TECH-204`)
   - `name`: VARCHAR(255) NOT NULL
   - `email`: VARCHAR(255) UNIQUE NOT NULL
   - `phone`: VARCHAR(50) NULLABLE
   - `specialization`: VARCHAR(100) NOT NULL (`Mechanical`, `Electrical`, `HVAC`, `Instrumentation`, `Hydraulics`)
   - `status`: VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' (`ACTIVE`, `ON_LEAVE`, `INACTIVE`)
   - `hourly_rate`: NUMERIC(10, 2) NULLABLE
   - `created_at`: TIMESTAMP WITH TIME ZONE NOT NULL

3. **maintenance_types**
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `code`: VARCHAR(50) UNIQUE NOT NULL (`PREVENTATIVE`, `CORRECTIVE`, `EMERGENCY`, `INSPECTION`, `CALIBRATION`)
   - `name`: VARCHAR(100) NOT NULL
   - `description`: TEXT NULLABLE
   - `is_emergency`: BOOLEAN NOT NULL DEFAULT FALSE

4. **work_orders**
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `work_order_number`: VARCHAR(64) UNIQUE NOT NULL (e.g., `WO-2026-0042`)
   - `title`: VARCHAR(255) NOT NULL
   - `description`: TEXT NOT NULL
   - `asset_id`: INTEGER NOT NULL (FK -> `assets.id` ON DELETE RESTRICT)
   - `maintenance_type_id`: INTEGER NOT NULL (FK -> `maintenance_types.id`)
   - `priority`: VARCHAR(20) NOT NULL (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
   - `status`: VARCHAR(20) NOT NULL DEFAULT 'OPEN' (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
   - `assigned_technician_id`: INTEGER NULLABLE (FK -> `technicians.id` ON DELETE SET NULL)
   - `scheduled_date`: TIMESTAMP WITH TIME ZONE NOT NULL
   - `estimated_hours`: NUMERIC(6, 2) NOT NULL DEFAULT 1.0
   - `actual_hours`: NUMERIC(6, 2) NULLABLE
   - `resolution_summary`: TEXT NULLABLE
   - `cancellation_reason`: TEXT NULLABLE
   - `created_at`: TIMESTAMP WITH TIME ZONE NOT NULL
   - `updated_at`: TIMESTAMP WITH TIME ZONE NOT NULL

5. **work_order_status_history**
   - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
   - `work_order_id`: INTEGER NOT NULL (FK -> `work_orders.id` ON DELETE CASCADE)
   - `from_status`: VARCHAR(20) NULLABLE
   - `to_status`: VARCHAR(20) NOT NULL
   - `changed_by`: VARCHAR(100) NOT NULL DEFAULT 'System Dispatcher'
   - `notes`: TEXT NULLABLE
   - `created_at`: TIMESTAMP WITH TIME ZONE NOT NULL

---

## 3. API Contract Specification

All endpoints follow REST principles with standard HTTP response codes (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `422 Unprocessable Entity`).

### Work Orders
- `GET /api/work-orders`
  - Query Params:
    - `q`: string (search term for WO number, title, or description)
    - `status`: string (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
    - `priority`: string (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
    - `asset_id`: integer
    - `technician_id`: integer
  - Response: `WorkOrderListResponse`
- `POST /api/work-orders`
  - Body: `WorkOrderCreate`
  - Validates Rules 1, 2, 5, 6.
  - Generates unique sequence number under concurrent transactions.
  - Automatically records initial history event (`NULL -> OPEN` or `NULL -> ASSIGNED`).
  - Response: `WorkOrderResponse` (HTTP 201)
- `GET /api/work-orders/{id}`
  - Response: Detailed work order with joined `asset`, `technician`, `maintenance_type`, and ordered `status_history`.
- `PATCH /api/work-orders/{id}`
  - Update mutable metadata (e.g. title, description, priority, scheduled_date, estimated_hours, assigned technician). Revalidates CRITICAL rule and past date rule.
- `POST /api/work-orders/{id}/transition`
  - Body: `{ "to_status": string, "notes": string, "changed_by": string, "actual_hours": float?, "resolution_summary": string?, "cancellation_reason": string? }`
  - Strictly enforces the state machine:
    - `OPEN -> ASSIGNED | CANCELLED`
    - `ASSIGNED -> IN_PROGRESS | CANCELLED`
    - `IN_PROGRESS -> COMPLETED`
    - `COMPLETED -> [FORBIDDEN - TERMINAL]` (Rule 3)
    - `CANCELLED -> [FORBIDDEN - TERMINAL]` (Rule 4)
    - Transitioning to `CRITICAL` or maintaining `CRITICAL` requires valid `assigned_technician_id` (Rule 2).

### Assets
- `GET /api/assets`
  - Query Params: `q`, `status`, `category`
- `POST /api/assets`
  - Body: `AssetCreate`
- `GET /api/assets/{id}`
  - Includes full asset specifications + associated work orders history with downtime metrics.
- `PUT /api/assets/{id}`
  - Edit asset status, location, category, notes, criticality.

### Technicians
- `GET /api/technicians`
  - Query Params: `status`, `specialization`
- `POST /api/technicians`
  - Body: `TechnicianCreate`
- `GET /api/technicians/{id}`
  - Technician bio, contact, assigned active/completed work orders, utilization metrics.

### System / Summary
- `GET /api/dashboard/stats`
  - Operational KPIs: Open, Assigned, In Progress, Completed, Overdue, Critical Unassigned count, High Priority count.
- `POST /api/seed`
  - Seeds realistic industrial machinery and technician data with pre-populated lifecycle histories.

---

## 4. Folder Structure

```
├── ARCHITECTURE.md              # Architectural specification & ERD
├── AI_USAGE.md                  # Development audit & human decisions
├── README.md                    # Setup, migrations & test execution
├── backend/                     # Python FastAPI Backend
│   ├── alembic/                 # Alembic database migration scripts
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   ├── alembic.ini
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py            # Environment & database settings
│   │   ├── database.py          # SQLAlchemy engine & session factory
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── asset.py
│   │   │   ├── technician.py
│   │   │   ├── maintenance_type.py
│   │   │   ├── work_order.py
│   │   │   └── checklist.py
│   │   ├── schemas/             # Pydantic v2 validation contracts
│   │   │   ├── asset.py
│   │   │   ├── technician.py
│   │   │   ├── work_order.py
│   │   │   ├── analytics.py
│   │   │   ├── asset_health.py
│   │   │   └── checklist.py
│   │   ├── services/            # Domain services & business rules
│   │   │   ├── sequence.py      # Concurrency-safe WO sequence generator
│   │   │   ├── work_order_service.py # State machine & 6 business rules
│   │   │   ├── recommendation_service.py # Explainable technician recommendation engine
│   │   │   ├── analytics_service.py # SQL aggregations, completion rate & overdue reports
│   │   │   ├── asset_health_service.py # Explainable 0-100 asset risk health scoring
│   │   │   └── checklist_service.py # Inspection checklist execution & attachment safety
│   │   ├── routers/             # FastAPI API endpoints
│   │   │   ├── assets.py        # Asset CRUD, health, and paginated lists
│   │   │   ├── technicians.py   # Technician directory and prospective recommendations
│   │   │   ├── work_orders.py   # Work orders (GET with pagination, POST, PUT & PATCH, CSV export)
│   │   │   ├── dashboard.py     # Aggregated analytics, overdue reports, workload reports
│   │   │   └── checklists.py    # Inspection checklist templates and execution
│   │   └── seed.py              # Realistic data seeder (protected in production)
│   ├── main.py                  # FastAPI application entrypoint & security middleware
│   └── tests/                   # Pytest automated test suite (85 tests)
├── scripts/
│   └── verify_api.py            # End-to-end verification suite (23 live checks against MySQL)
├── server.ts                    # Express dev server (proxy to FastAPI & fallback engine)
├── src/                         # Frontend React Application
│   ├── api/                     # Type-safe API client layer
│   │   ├── client.ts            # REST client with PUT/PATCH and pagination
│   │   └── types.ts             # TypeScript domain interfaces
│   ├── components/              # UI components
│   │   ├── layout/              # Sidebar (desktop + mobile drawer), Header
│   │   ├── ui/                  # Button, Badge, Modal, Input, Select, Table
│   │   ├── work-orders/         # WO Table (paginated), Filters, Dispatch Sheet, Checklists
│   │   ├── assets/              # Asset Modal, Asset Details Drawer, Health Card, RiskBadge
│   │   ├── technicians/         # Technician Modal, Recommendations Card
│   │   └── analytics/           # MaintenanceAnalyticsView (Recharts, reports)
│   ├── pages/                   # Main Views
│   │   ├── WorkOrdersPage.tsx   # Work Order List with combined filters & search
│   │   ├── WorkOrderDetailPage.tsx # Detailed view with history timeline & checklists
│   │   ├── CreateWorkOrderPage.tsx # Validated work order creation with smart recommendations
│   │   ├── AssetsPage.tsx       # Asset registry with pagination & health monitoring
│   │   ├── TechniciansPage.tsx  # Technician directory & active workload
│   │   └── AnalyticsPage.tsx    # Dedicated analytics & audit report dashboards
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
```

---

## 5. API Endpoint Specifications

### Work Orders
- `GET /api/work-orders`: Filter by `q`, `status`, `priority`, `asset_id`, `technician_id`, `start_date`, `end_date`, `is_overdue`. Supports pagination with `page`, `page_size`, and returns `X-Total-Count` header.
- `POST /api/work-orders`: Create work order enforcing all 6 business rules.
- `GET /api/work-orders/{id}`: Detailed work order with asset, technician, type, and history.
- `PUT /api/work-orders/{id}`: Full update of work order metadata.
- `PATCH /api/work-orders/{id}`: Partial update of work order metadata (identical handler to PUT).
- `POST /api/work-orders/{id}/transition`: State machine transition (`OPEN` -> `ASSIGNED` -> `IN_PROGRESS` -> `COMPLETED`, or `CANCELLED`).
- `GET /api/work-orders/{id}/history`: Chronological audit trail.
- `GET /api/work-orders/export`: RFC 4180 CSV export of filtered work orders.

### Technician Recommendations
- `GET /api/work-orders/{id}/technician-recommendations`: Top 3 recommended technicians for existing work order.
- `GET /api/technicians/recommendations`: Prospective recommendations for work order creation.

### Analytics & Reports
- `GET /api/dashboard/stats`: High-level counters for dashboard stat cards.
- `GET /api/dashboard/analytics`: Comprehensive SQL aggregations, completion rates, overdue metrics, workload, and trends.
- `GET /api/dashboard/reports/overdue` & `/export`: Audited overdue orders with CSV download.
- `GET /api/dashboard/reports/technician-workload` & `/export`: Capacity utilization and CSV download.

### Asset Health & Checklists
- `GET /api/assets/health`: Fleet-wide 0-100 risk scoring.
- `GET /api/assets/{id}/health`: Single asset risk factor breakdown.
- `GET /api/work-orders/{id}/checklists`: Digital inspection checklist with pass/fail/na states.

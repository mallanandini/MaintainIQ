# MaintainIQ — Maintenance Work Order Management

MaintainIQ is a production-quality enterprise maintenance work-order management application designed around strict state transition logic, asset integrity rules, and concurrent-safe sequence generation.

Built as an engineering assessment demonstrating full-stack architecture, relational database normalization, and strict domain validation.

---

## 🛠 Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts (responsive operational analytics)
- **Backend Service**: Python 3.10+, FastAPI, Pydantic v2, Uvicorn
- **Persistence & Relational Database**: MySQL 8.0 (primary operational/production database via PyMySQL), SQLite (in-memory test isolation), SQLAlchemy 2.0 ORM
- **Database Migrations**: Alembic version-controlled schema migrations (`001_initial_schema`, `002_status_audit_trail_update`, `003_analytics_indexes`)
- **Full-Stack Application Host**: Node.js / Express with TypeScript reverse proxy (`server.ts`)
- **Automated Verification**: Pytest suite (business rules, audit trails, smart recommendations, analytics aggregations, production security) + End-to-end live MySQL verification suite (`scripts/verify_api.py`)

> **Architecture & UI Principle**: Technology stack and infrastructure details are maintained exclusively in documentation (`README.md` and `ARCHITECTURE.md`) rather than displayed in the end-user sidebar navigation. Reseeding operations (`POST /api/seed`) are restricted and disabled in production environments to protect live database records.

---

## 🔒 Mandatory Business Rules & Validation

The backend enforces six strict business rules on work orders:

1. **Rule 1 — Unique Work-Order Numbering Under Concurrency**: Work-order numbers (e.g. `WO-2026-0001`) are monotonically generated using memory-lock sequence generation and unique database constraints.
2. **Rule 2 — Mandatory Technician on CRITICAL Orders**: A work order with `CRITICAL` priority must have an assigned technician both at creation and whenever updated to `CRITICAL`.
3. **Rule 3 — Terminal State Integrity (COMPLETED)**: Once marked `COMPLETED`, a work order cannot return to `OPEN` or transition to any other status.
4. **Rule 4 — Terminal State Integrity (CANCELLED)**: Once marked `CANCELLED`, a work order cannot move to `IN_PROGRESS` or any other status.
5. **Rule 5 — Future Scheduling Only**: New work orders cannot have a `scheduled_date` in the past.
6. **Rule 6 — OUT_OF_SERVICE Asset Protection**: Machinery with `OUT_OF_SERVICE` status cannot receive standard/routine work orders; only `EMERGENCY` maintenance types or `CRITICAL` priority orders are accepted.

### Valid Lifecycle State Machine
```
[ OPEN ] ────► [ ASSIGNED ] ────► [ IN_PROGRESS ] ────► [ COMPLETED (Terminal) ]
   │                 │
   └────────┬────────┘
            ▼
    [ CANCELLED (Terminal) ]
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **Python**: 3.10 or higher

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Installation
Install Node.js dependencies:
```bash
npm install
```

Install Python backend dependencies:
```bash
pip install fastapi "uvicorn[standard]" sqlalchemy alembic pytest pydantic email-validator httpx psycopg2-binary
```

### 4. Running Migrations & Seeding
Run Alembic schema migrations:
```bash
alembic -c backend/alembic.ini upgrade head
```

Seed initial industrial demo assets and maintenance logs (development only):
```bash
python -m backend.app.seed
```

> **Security Note**: In production (`ENVIRONMENT=production` or `ALLOW_SEEDING=false`), the `/api/seed` endpoint is disabled to prevent accidental or malicious data modification. Only authenticated requests with a valid `X-Admin-Key` header matching `ADMIN_API_KEY` can trigger seeding.

### 5. Running the Application
Launch both the Python FastAPI service and Vite React frontend with a single command:
```powershell
.\start-dev.ps1
# Or via npm:
npm run start:dev
```
- **MaintainIQ Portal**: `http://localhost:3001`
- **Interactive Swagger API Documentation**: `http://localhost:3001/docs`
- **Standalone FastAPI Service**: `http://127.0.0.1:8000`

To safely stop all development servers and clear ports:
```powershell
.\stop-dev.ps1
# Or via npm:
npm run stop:dev
```

To run complete 4-tier health diagnostics (MySQL, FastAPI, Express Proxy, Live API):
```powershell
npm run health
```

> **Official Test Report**: A manager-ready 9-page verification report with embedded screenshots is available at `MaintainIQ_Final_Test_Report.pdf` and in the `TEST_EVIDENCE/` directory.

---

## 🧪 Automated Testing

Execute the complete automated test suite covering all 6 mandatory business rules, concurrency constraints, state transitions, and search/filter combinations:

```bash
npm run test:backend
# Or directly via pytest:
python3 -m pytest backend/tests -v
```

### Test Coverage Highlights
- `test_rule_1_unique_work_order_numbers_concurrent`: Parallel thread worker dispatch verifying unique numbering.
- `test_rule_2_critical_without_technician_rejected_on_create`: Rejection of critical orders without technicians.
- `test_rule_2_updating_to_critical_without_technician_rejected`: Protection against bypassing Rule 2 during update.
- `test_rule_3_completed_cannot_return_to_open`: Verification of terminal completed state.
- `test_rule_4_cancelled_cannot_move_to_in_progress`: Verification of terminal cancelled state.
- `test_rule_5_cannot_schedule_in_past`: Strict past-date prevention.
- `test_rule_6_out_of_service_asset_rejects_routine_work_order`: Prevents non-emergency work on out-of-service assets.
- `test_rule_6_out_of_service_asset_accepts_emergency_work_order`: Verifies emergency exemption.
- `test_technician_lifecycle`: Deactivation, reactivation, active-assignment guardrails (HTTP 409), deletion audit trail protection (HTTP 409), and clean deletion (HTTP 200).
- `test_command_center`: Table and Kanban view state transitions, server-side pagination, safe bulk technician assignment, duplication, and CSV export.
- `test_valid_transitions_lifecycle`: Full state machine traversal.
- `test_work_order_search_and_combined_filters`: Multi-criteria querying (status, priority, asset, technician).
- `test_inspection_checklists`: Checklist templates, item transitions, snapshot isolation, and evidence attachments.
- `test_technician_recommendations`: Deterministic ranking, workload penalties, skill match, and tie-breaking.
- `test_maintenance_analytics`: Database aggregations, completion rates, overdue metrics, and monthly trends.
- `test_reporting_and_audit`: CSV exports, date window filtering, and audit history.

---

## 👨‍🔧 Technician Lifecycle Management

MaintainIQ Enterprise v3.0 provides full operational lifecycle management for maintenance technicians and field engineers while preserving strict regulatory audit trails and operational safety:

### Operational Lifecycle States
- **ACTIVE**: Available for direct dispatch and deterministic smart recommendations based on trade discipline and active workload.
- **ON_LEAVE**: Temporarily unavailable for new scheduled dispatch.
- **INACTIVE**: Deactivated personnel. Strictly prohibited from receiving new work orders, updates, or bulk assignments. Excluded from recommendations.

### Safety Guardrails & Business Logic
1. **Deactivate Technician (`PUT /api/technicians/{id}`)**:
   - Updates the technician status to `INACTIVE`.
   - **Active Assignment Guardrail (HTTP 409 Conflict)**: If the technician has active work orders in `ASSIGNED` or `IN_PROGRESS` status, deactivation is strictly blocked. The API enumerates the active work order numbers and requires reassignment or completion before deactivation can proceed.
2. **Reactivate Technician (`PUT /api/technicians/{id}`)**:
   - Restores technician status to `ACTIVE`. Immediately eligible for work order dispatch and recommendation algorithms.
3. **Permanent Deletion (`DELETE /api/technicians/{id}`)**:
   - **Audit Trail Protection (HTTP 409 Conflict)**: Technicians with associated work orders (past or present) cannot be permanently deleted. This preserves historical accountability, safety compliance, and maintenance log integrity.
   - **Clean Deletion (HTTP 200 OK)**: Technicians registered without any associated work orders can be safely deleted.
4. **Access Control Clarification**:
   - MaintainIQ is currently deployed in local operational mode without multi-tenant role-based access control (RBAC). Safety is enforced through database foreign keys, relationship constraints, and backend service guardrails.

---

## 📋 Advanced Work Order Command Center

The Command Center provides a high-density operations center for maintenance supervisors and dispatchers:
- **Table & Kanban Views**: Seamless toggle between data table and drag-and-drop Kanban board grouped by status (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- **Enforced State Machine Transitions**: Kanban column transitions strictly enforce backend validation rules. Terminal states (`COMPLETED`, `CANCELLED`) reject invalid transitions with meaningful feedback.
- **Advanced Filtering**: Real-time filtering by status, priority, asset, technician, maintenance type, date ranges, and overdue status with local preset persistence.
- **Safe Bulk Assignment**: Bulk technician assignment with per-record validation and clear partial-failure reporting.
- **Work Order Duplication**: Clones work orders with newly generated sequential identifiers while re-validating all creation rules.
- **Data Export**: Server-side CSV export respecting all active filters.

---

## 🛡️ Asset Health & Risk Monitoring

MaintainIQ provides a deterministic, explainable asset health and maintenance risk evaluation module designed strictly on documented operational data.

> **Important Disclaimer**: This assessment is a rule-based maintenance risk indicator based on documented service history, scheduled dates, and operating thresholds. It does not predict mechanical equipment failure.

### Deterministic Risk Scoring Formula

The risk index is calculated dynamically on a 0–100 scale using four transparent operational dimensions:

1. **Overdue Maintenance Risk (Max 35 points)**
   - Uncompleted work orders with scheduled dates in the past.
   - Critical overdue: 20 pts each
   - High overdue: 15 pts each
   - Medium / Low overdue: 10 pts each
2. **Active Work Order Severity (Max 25 points)**
   - Unresolved open work orders requiring attention.
   - Active Critical work order: 15 pts each
   - Active High work order: 8 pts each
   - Active Medium work order: 3 pts each
3. **Recent Corrective Repair Recurrence (Max 20 points)**
   - Corrective maintenance / breakdown repairs logged in the past 90 days (10 pts each).
4. **Operating Utilization (Max 20 points)**
   - Cumulative operating hours and operating cycles relative to configured service thresholds.
   - Exceeding either threshold adds 20 pts; reaching $\ge 80\%$ utilization scales proportionally.

### Clamping & Status Floors
- Total score is clamped to $[0.0, 100.0]$.
- **Status Floors**:
  - Assets with `OUT_OF_SERVICE` status receive a minimum score floor of `75.0` (Critical Risk).
  - Assets with `UNDER_MAINTENANCE` status receive a minimum score floor of `50.0` (High Risk).

### Risk Categories & Thresholds
- **CRITICAL**: $75.0 \le \text{Score} \le 100.0$
- **HIGH**: $50.0 \le \text{Score} < 75.0$
- **MODERATE**: $25.0 \le \text{Score} < 50.0$
- **LOW**: $0.0 \le \text{Score} < 25.0$
- **INSUFFICIENT_DATA**: Explicitly returned when an asset has neither logged operating metrics nor any maintenance records, avoiding misleading scores.

---

## 📁 Repository Structure & Assessment Deliverables

- `TEST_RESULTS.md`: Comprehensive, evidence-based testing report covering all 97 backend tests, 27 live API verification checks, and business rules.
- `reports/backend-test-results.txt`: Raw, unedited Pytest output for all 97 backend tests.
- `reports/api-test-results.txt`: Step-by-step console log for 27 live database E2E checks.
- `reports/frontend-build-results.txt`: Output of production build verifying zero TypeScript errors.
- `reports/test-summary.json`: Machine-readable summary of all assessment metrics.
- `screenshots/`: 7 full-fidelity PNG screenshots documenting every module in the portal.
- `backend/`: FastAPI application, Pydantic schemas, SQLAlchemy models, and Alembic migrations.
- `backend/tests/`: Pytest suite (97 automated tests) verifying business rules, technician lifecycle, recommendations, analytics, checklists, and asset health.
- `scripts/verify_api.py`: Comprehensive end-to-end verification suite (27 live checks against MySQL database).
- `server.ts`: Express development host and reverse proxy to FastAPI.
- `src/`: React 19 TypeScript application with Tailwind CSS, Lucide icons, and Recharts.



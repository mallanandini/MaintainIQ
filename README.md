# MaintainIQ — Maintenance Work Order Management

MaintainIQ is a production-quality enterprise maintenance work-order management application designed around strict state transition logic, asset integrity rules, and concurrent-safe sequence generation.

Built as an engineering assessment demonstrating full-stack architecture, relational database normalization, and strict domain validation.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend Service**: Python 3.10+, FastAPI, Pydantic v2
- **Persistence & ORM**: PostgreSQL / SQLite, SQLAlchemy 2.0
- **Database Migrations**: Alembic
- **Full-Stack Host**: Node.js / Express with TypeScript proxy
- **Test Automation**: Pytest with automated business rule verification suite

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

Seed realistic industrial demo assets and maintenance logs:
```bash
python3 -m backend.app.seed
```

### 5. Running the Application
Launch both the Python FastAPI service and Vite React frontend with a single command:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.
API Swagger documentation is accessible at **`http://localhost:3000/docs`**.

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
- `test_valid_transitions_lifecycle`: Full state machine traversal.
- `test_work_order_search_and_combined_filters`: Multi-criteria querying (status, priority, asset, technician).

---

## 📁 Repository Structure

- `ARCHITECTURE.md`: Detailed architecture proposal, relational ERD, and API contract.
- `AI_USAGE.md`: Comprehensive audit of AI-assisted generation, modifications, bugs discovered, and human decisions.
- `backend/`: FastAPI application, Pydantic schemas, SQLAlchemy models, and Alembic migrations.
- `backend/tests/`: Pytest suite verifying business rules.
- `server.ts`: Express development host and reverse proxy to FastAPI.
- `src/`: React 19 TypeScript application with Tailwind CSS.

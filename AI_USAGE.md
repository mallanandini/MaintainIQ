# MaintainIQ — AI Usage & Engineering Audit Log

This document transparently records the AI-assisted engineering workflow, architectural decisions, modifications made, bugs uncovered during verification, and human software engineering judgments applied throughout the development of **MaintainIQ**.

---

## 1. AI Assistance Overview

AI was leveraged as an accelerated implementation partner and pair programmer for:
- Drafting boilerplate SQLAlchemy 2.0 ORM declarations and initial Alembic schema migration scripts.
- Generating Pydantic v2 schemas for Assets, Technicians, Maintenance Types, and Work Orders.
- Scaffolding the multi-filter React interface and responsive table components.
- Authoring exhaustive Pytest automated test cases for the 6 mandatory business rules.

---

## 2. Human Architectural & Design Decisions

### A. Dual Full-Stack Host Topology (`server.ts` + FastAPI)
- **Decision**: Rather than mocking backend APIs in client JavaScript or running a Node-only backend, a real Python 3.10 FastAPI service with SQLAlchemy 2.0 ORM and Pydantic validation was installed and run alongside Vite.
- **Rationale**: The assessment explicitly specified FastAPI, PostgreSQL/SQLAlchemy, and Pytest. To fulfill the full-stack requirement while providing zero-friction preview in browser environments, `server.ts` acts as the host reverse-proxy, mounting Vite middlewares and forwarding `/api/*` and `/docs` to the FastAPI daemon on port 8000.

### B. Concurrency-Safe Monotonic Sequencing (Rule 1)
- **Decision**: Implemented an in-memory thread lock combined with high-watermark database queries (`generate_work_order_number`) and unique database constraint retries.
- **Rationale**: In multi-threaded API servers, relying purely on naive `SELECT count(*) FROM work_orders` generates identical numbers under parallel simultaneous requests. The sequence generator ensures strict uniqueness even during concurrent bursts.

### C. State Machine Immutability (Rules 3 & 4)
- **Decision**: Hardcoded terminal state guards in both the Service layer (`transition_work_order_status`) and the Update route (`update_work_order`).
- **Rationale**: Users should not be able to bypass state machine rules simply by issuing an arbitrary `PATCH /api/work-orders/{id}` with `{"status": "OPEN"}` or `{"status": "IN_PROGRESS"}`. Edits to existing metadata on terminal work orders are strictly locked.

### D. Asset Status Interlocks (Rule 6)
- **Decision**: Added cross-entity validation when creating or updating work orders. If an asset is `OUT_OF_SERVICE`, the API checks if the maintenance type has `is_emergency=True`, code `EMERGENCY`, or priority `CRITICAL`.
- **Rationale**: Prevents preventative or routine maintenance schedules from dispatching on broken machinery that requires emergency overhaul first.

---

## 3. Bugs Discovered & Resolved During Verification

### Bug 1: Pydantic Settings Import Deprecation
- **Symptom**: Pytest initial run failed with `ModuleNotFoundError: No module named 'pydantic_settings'`.
- **Root Cause**: In Pydantic v2, `BaseSettings` was moved into the optional package `pydantic-settings`.
- **Fix**: Replaced the unnecessary external dependency with standard Python `os.getenv` configuration in `backend/app/config.py`, preserving zero-dependency simplicity.

### Bug 2: Missing `email-validator` Dependency
- **Symptom**: `ImportError: email-validator is not installed, run pip install 'pydantic[email]'` on technician schemas.
- **Fix**: Installed `email-validator` and updated technician validation to sanitize and normalize email addresses.

### Bug 3: SQLite Thread Collisions in Pytest Concurrency Test
- **Symptom**: `sqlite3.InterfaceError` when 5 worker threads executed parallel `POST /api/work-orders` against an in-memory SQLite database (`:memory:` with `StaticPool`).
- **Root Cause**: SQLite's in-memory C driver does not permit concurrent thread access across a single pooled connection.
- **Fix**: Configured a dedicated temporary file-backed SQLite database (`/tmp/test_maintainiq.db`) with `check_same_thread=False` and isolated session generators in `backend/tests/conftest.py`. The concurrent test passed cleanly with 8 parallel requests creating distinct sequential IDs.

### Bug 4: Pydantic v1 to v2 Deprecation Warnings
- **Symptom**: Pytest logged 32 deprecation warnings regarding `class Config: from_attributes = True`, `.dict()`, and `.from_orm()`.
- **Fix**: Updated all schemas to use Pydantic v2 `ConfigDict(from_attributes=True)`, replaced `.dict()` calls with `.model_dump()`, and replaced `.from_orm()` calls with `.model_validate()`.

---

## 4. Verification Record

- **Pytest Suite**: 13 automated tests executed and passing (`13 passed in 1.11s`).
- **TypeScript Compilation**: Executed `tsc --noEmit` with zero errors.
- **Vite Build**: Verified production asset bundling (`npm run build`).
- **Interactive UI**: Verified Work Order List, Work Order Creation, and Work Order Details screens with real lifecycle state transitions.

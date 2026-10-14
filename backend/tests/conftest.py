import os
import sys
import tempfile
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure root directory is on python path
sys.path.insert(0, os.path.abspath("."))

from backend.app.database import Base, get_db
from backend.main import app
from backend.app.models.asset import Asset
from backend.app.models.technician import Technician
from backend.app.models.maintenance_type import MaintenanceType

TEST_DB_FILE = os.path.join(tempfile.gettempdir(), "test_maintainiq.db")
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

@pytest.fixture(scope="session")
def engine():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
    eng = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30}
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

@pytest.fixture(scope="function")
def db_session(engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # Clear previous test data in tables
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()

    # Pre-populate test baseline types, assets and technicians
    m_prev = MaintenanceType(code="PREVENTATIVE", name="Preventative", is_emergency=False)
    m_corr = MaintenanceType(code="CORRECTIVE", name="Corrective", is_emergency=False)
    m_emerg = MaintenanceType(code="EMERGENCY", name="Emergency", is_emergency=True)
    m_fake_emerg = MaintenanceType(code="EMERGENCY_DECOY", name="Emergency Decoy", is_emergency=False)
    session.add_all([m_prev, m_corr, m_emerg, m_fake_emerg])
    session.flush()

    tech1 = Technician(
        employee_id="TECH-T1",
        name="Alex Smith",
        email="alex.smith@test.com",
        specialization="Electrical",
        status="ACTIVE"
    )
    tech_inactive = Technician(
        employee_id="TECH-T2",
        name="Inactive Guy",
        email="inactive@test.com",
        specialization="Mechanical",
        status="INACTIVE"
    )
    tech_leave = Technician(
        employee_id="TECH-T3",
        name="Leave Guy",
        email="leave@test.com",
        specialization="HVAC",
        status="ON_LEAVE"
    )
    session.add_all([tech1, tech_inactive, tech_leave])
    session.flush()

    asset_op = Asset(
        asset_tag="AST-TEST-01",
        name="Operational Test Pump",
        category="Hydraulics",
        location="Room 1",
        status="OPERATIONAL",
        criticality="HIGH"
    )
    asset_oos = Asset(
        asset_tag="AST-TEST-02",
        name="Out of Service Compressor",
        category="Pneumatics",
        location="Room 2",
        status="OUT_OF_SERVICE",
        criticality="CRITICAL"
    )
    asset_decom = Asset(
        asset_tag="AST-TEST-03",
        name="Decommissioned Boiler",
        category="Thermal",
        location="Room 3",
        status="DECOMMISSIONED",
        criticality="LOW"
    )
    session.add_all([asset_op, asset_oos, asset_decom])
    session.commit()

    yield session
    session.close()

@pytest.fixture(scope="function")
def client(engine, db_session):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

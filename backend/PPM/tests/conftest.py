import os
import sys
import pytest
from unittest.mock import AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import httpx

# Add parent directory to python path for backend imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from db import Base, get_db
from main import app
from security.auth import get_current_user
from models.user_model import User
from models.model import Proposal, Remarks, MessageGroup, GroupMember, Message, MessageSeen
import re
from sqlalchemy import event
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import ARRAY

# Register compilation handler for PostgreSQL ARRAY types on SQLite dialect for in-memory testing
@compiles(ARRAY, "sqlite")
def compile_array_sqlite(element, compiler, **kw):
    return "TEXT"

# In-memory SQLite database engine for fast, isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def register_sqlite_functions(dbapi_connection, connection_record):
    def regexp_replace_3(string, pattern, replacement):
        if string is None:
            return None
        return re.sub(pattern, replacement, string)

    def regexp_replace_4(string, pattern, replacement, flags):
        if string is None:
            return None
        return re.sub(pattern, replacement, string)

    dbapi_connection.create_function("regexp_replace", 3, regexp_replace_3)
    dbapi_connection.create_function("regexp_replace", 4, regexp_replace_4)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Creates all database tables once for the test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """
    Creates a fresh database session for each test function,
    running within a transaction that rolls back automatically.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session, test_user_admin):
    """
    FastAPI TestClient with overridden get_db and get_current_user dependencies.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return {
            "sub": str(test_user_admin.id),
            "name": test_user_admin.name,
            "email": test_user_admin.email,
            "roles": [test_user_admin.role]
        }

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def unauthenticated_client(db_session):
    """
    FastAPI TestClient without authentication overrides to test 401 Unauthorized errors.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def async_client(db_session, test_user_admin):
    """
    HTTPX AsyncClient for testing async endpoints.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return {
            "sub": str(test_user_admin.id),
            "name": test_user_admin.name,
            "email": test_user_admin.email,
            "roles": [test_user_admin.role]
        }

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    async with httpx.AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def mock_minio_upload(monkeypatch):
    """
    Mocks upload_file_to_minio to avoid external MinIO service calls during tests.
    """
    async def fake_upload(file, object_name=None):
        filename = getattr(file, "filename", "file.pdf")
        obj_path = object_name or f"documents/messages/mock_{filename}"
        public_url = f"http://localhost:9000/ppm-bucket/{obj_path}"
        return obj_path, public_url

    monkeypatch.setattr("services.minio_client.upload_file_to_minio", fake_upload)
    monkeypatch.setattr("routes.remarksroutes.upload_file_to_minio", fake_upload)
    monkeypatch.setattr("routes.groupchatroutes.upload_file_to_minio", fake_upload)
    return fake_upload


# Helper User Fixtures
@pytest.fixture
def test_user_admin(db_session):
    user = User(
        name="Admin User",
        email="admin@cmti.res.in",
        role="admin",
        center="C-PPM",
        group="PPM",
        password="hashedpassword123"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user_scientist(db_session):
    user = User(
        name="Dr. Scientist B",
        email="scientist@cmti.res.in",
        role="scientist",
        center="C-SMPM",
        group="SMPM",
        password="hashedpassword123"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user_gh(db_session):
    user = User(
        name="Group Head User",
        email="gh@cmti.res.in",
        role="gh",
        center="C-SMPM",
        group="SMPM",
        password="hashedpassword123"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_proposal(db_session):
    prop = Proposal(
        customer_name="Test Customer Ltd",
        email="customer@test.com",
        quote_reference="REF/2026/001",
        quote_description="Design and Testing Project",
        quote_amount="500000",
        proposal_status="Submitted"
    )
    db_session.add(prop)
    db_session.commit()
    db_session.refresh(prop)
    return prop

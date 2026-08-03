import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from fastapi import HTTPException

# Patch SQLite type compiler to handle PostgreSQL ARRAY in tests
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from models.model import Base, Proposal, Customer, Payment, Stage, Progress, Document, Remarks
from models.user_model import User
from ai.context_builder import ContextBuilder, context_builder

# Setup in-memory SQLite database for testing ContextBuilder
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    target_tables = [
        Proposal.__table__,
        Customer.__table__,
        Payment.__table__,
        Stage.__table__,
        Progress.__table__,
        Document.__table__,
        Remarks.__table__,
        User.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=target_tables)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine, tables=target_tables)


class TestContextBuilder:
    def test_non_existent_proposal_raises_404(self, db_session):
        """Verifies that requesting context for a non-existent proposal ID raises 404 HTTPException."""
        builder = ContextBuilder()
        with pytest.raises(HTTPException) as exc_info:
            builder.build_proposal_context(db_session, proposal_id=99999)

        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail.lower()

    def test_build_proposal_context_returns_structured_data(self, db_session):
        """Verifies that ContextBuilder correctly retrieves and formats all related entity records."""
        # 1. Seed Customer
        customer = Customer(
            name="M/s. Toyota Industries Engine India Pvt Ltd.",
            customer_type="Private",
            gst="29ABCDE1234F1ZH",
            address="Phase-II, Jigani, Bengaluru-560105",
            email="contact@toyota-industries.in"
        )
        db_session.add(customer)

        # 2. Seed Proposal
        proposal = Proposal(
            customer_name="M/s. Toyota Industries Engine India Pvt Ltd.",
            quote_reference="PPM/SMPM/020/2026-27(11)",
            quote_description="Migration support for GD & TNGA Plant",
            quote_amount="260000",
            proposal_status="Submitted",
            center="C-SMPM",
            project_co_ordinator="Manjunath",
            quotation_given_by_name="Narendra Reddy T"
        )
        db_session.add(proposal)
        db_session.commit()
        db_session.refresh(proposal)

        # 3. Seed Stage
        stage = Stage(name="Technical Review", position=1)
        db_session.add(stage)
        db_session.commit()
        db_session.refresh(stage)

        # 4. Seed Payment
        payment = Payment(
            project_id=proposal.id,
            stage_id=stage.id,
            amount_claimed="130000",
            amount_recieved="130000",
            invoice_no="INV-2026-001"
        )
        db_session.add(payment)

        # 5. Seed Progress
        progress = Progress(
            project_id=proposal.id,
            stage_id=stage.id,
            remarks="Stage 1 technical review completed.",
            updated_by="Manjunath"
        )
        db_session.add(progress)

        # 6. Seed Document
        document = Document(
            project_id=proposal.id,
            name="Quotation_v1.docx",
            url="/uploads/Quotation_v1.docx",
            uploaded_by="Narendra Reddy T",
            version="1.0"
        )
        db_session.add(document)

        # 7. Seed Remarks / Chat
        remark = Remarks(
            from_="Scientist",
            to="Group Head",
            project_id=proposal.id,
            remarks_description="Draft quotation uploaded for approval."
        )
        db_session.add(remark)

        # 8. Seed User
        user = User(
            name="Manjunath",
            email="manjunath@cmti.res.in",
            role="project-coordinator",
            center="C-SMPM",
            group="SMPM",
            password="secret_hash"
        )
        db_session.add(user)

        db_session.commit()

        # Build context
        context = context_builder.build_proposal_context(db_session, proposal.id)

        # Assert top-level key structure
        assert "proposal" in context
        assert "customer" in context
        assert "payments" in context
        assert "stages" in context
        assert "progress" in context
        assert "documents" in context
        assert "remarks" in context
        assert "assigned_users" in context

        # Assert authentic data values
        assert context["proposal"]["id"] == proposal.id
        assert context["proposal"]["quote_reference"] == "PPM/SMPM/020/2026-27(11)"

        assert context["customer"] is not None
        assert context["customer"]["name"] == "M/s. Toyota Industries Engine India Pvt Ltd."
        assert context["customer"]["gst"] == "29ABCDE1234F1ZH"

        assert len(context["payments"]) == 1
        assert context["payments"][0]["invoice_no"] == "INV-2026-001"
        assert context["payments"][0]["amount_recieved"] == "130000"

        assert len(context["stages"]) == 1
        assert context["stages"][0]["name"] == "Technical Review"

        assert len(context["progress"]) == 1
        assert context["progress"][0]["stage_name"] == "Technical Review"

        assert len(context["documents"]) == 1
        assert context["documents"][0]["name"] == "Quotation_v1.docx"

        assert len(context["remarks"]) == 1
        assert context["remarks"][0]["remarks_description"] == "Draft quotation uploaded for approval."

        assert len(context["assigned_users"]) == 1
        assert context["assigned_users"][0]["name"] == "Manjunath"
        assert "password" not in context["assigned_users"][0]  # Excluded for security

from typing import Dict, Any, List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from models.model import Proposal, Customer, Payment, Stage, Progress, Document, Remarks
from models.user_model import User


class ContextBuilder:
    """
    ContextBuilder Service
    ----------------------
    Responsible ONLY for retrieving and structuring real database records for a given proposal
    into a standardized JSON-serializable dictionary context.

    Design Principles:
    - Single Responsibility: Data retrieval & formatting only.
    - Zero Hallucination / Zero Synthetic Data: Returns only authentic database values.
    - No External API / No Prompt / No LLM calls.
    - Modular & Helper-driven: Entity retrieval is broken down into reusable helper methods.
    """

    def build_proposal_context(self, db: Session, proposal_id: int) -> Dict[str, Any]:
        """
        Builds and returns the full structured context dictionary for a specific proposal.

        Raises:
            HTTPException: 404 Not Found if the proposal_id does not exist.

        Returns:
            Dict[str, Any] containing keys:
            - proposal
            - customer
            - payments
            - stages
            - progress
            - documents
            - remarks
            - assigned_users
        """
        proposal_obj = self._get_proposal(db, proposal_id)
        if not proposal_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with ID {proposal_id} not found in the database."
            )

        proposal_dict = self._serialize_model(proposal_obj)
        customer_dict = self._get_customer(db, proposal_obj.customer_name)
        payments_list = self._get_payments(db, proposal_id)
        stages_list = self._get_stages(db)
        progress_list = self._get_progress(db, proposal_id)
        documents_list = self._get_documents(db, proposal_id)
        remarks_list = self._get_remarks(db, proposal_id)
        assigned_users_list = self._get_assigned_users(db, proposal_obj)

        return {
            "proposal": proposal_dict,
            "customer": customer_dict,
            "payments": payments_list,
            "stages": stages_list,
            "progress": progress_list,
            "documents": documents_list,
            "remarks": remarks_list,
            "assigned_users": assigned_users_list,
        }

    # =========================================================================
    # PRIVATE ENTITY HELPER METHODS
    # =========================================================================

    def _get_proposal(self, db: Session, proposal_id: int) -> Optional[Proposal]:
        """Fetches the primary Proposal record by ID."""
        return db.query(Proposal).filter(Proposal.id == proposal_id).first()

    def _get_customer(self, db: Session, customer_name: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Fetches the matching Customer profile by name (case-insensitive).
        Returns None if customer_name is missing or no record is found.
        """
        if not customer_name or not customer_name.strip():
            return None

        clean_name = customer_name.strip().lower()
        customer_obj = db.query(Customer).filter(
            func.lower(Customer.name) == clean_name
        ).first()

        if customer_obj:
            return self._serialize_model(customer_obj)
        return None

    def _get_payments(self, db: Session, proposal_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all payment milestone records linked to the project.
        Returns an empty list [] if no payment records exist.
        """
        payments = db.query(Payment).filter(
            Payment.project_id == proposal_id
        ).order_by(Payment.id.asc()).all()

        return [self._serialize_model(p) for p in payments]

    def _get_stages(self, db: Session) -> List[Dict[str, Any]]:
        """
        Fetches all stage definitions ordered by position or ID.
        Returns an empty list [] if no stages exist.
        """
        stages = db.query(Stage).order_by(Stage.position.asc(), Stage.id.asc()).all()
        return [self._serialize_model(s) for s in stages]

    def _get_progress(self, db: Session, proposal_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all progress history entries linked to the project.
        Includes associated stage_name when available.
        Returns an empty list [] if no progress records exist.
        """
        progress_entries = db.query(Progress).filter(
            Progress.project_id == proposal_id
        ).order_by(Progress.id.asc()).all()

        result = []
        for prg in progress_entries:
            prg_dict = self._serialize_model(prg)
            if prg.stage:
                prg_dict["stage_name"] = prg.stage.name
            result.append(prg_dict)

        return result

    def _get_documents(self, db: Session, proposal_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all document records uploaded for the project.
        Returns an empty list [] if no documents exist.
        """
        docs = db.query(Document).filter(
            Document.project_id == proposal_id
        ).order_by(Document.created_at.desc()).all()

        return [self._serialize_model(d) for d in docs]

    def _get_remarks(self, db: Session, proposal_id: int) -> List[Dict[str, Any]]:
        """
        Fetches all communication remarks / chat queries for the project.
        Returns an empty list [] if no remarks exist.
        """
        remarks = db.query(Remarks).filter(
            Remarks.project_id == proposal_id
        ).order_by(Remarks.created_at.asc()).all()

        return [self._serialize_model(r) for r in remarks]

    def _get_assigned_users(self, db: Session, proposal: Proposal) -> List[Dict[str, Any]]:
        """
        Retrieves user profiles associated with the project (e.g. project_co_ordinator,
        quotation_given_by_name). Excludes password hashes for security.
        Returns an empty list [] if no matching users are found.
        """
        names_to_check = set()

        if proposal.project_co_ordinator and proposal.project_co_ordinator.strip():
            names_to_check.add(proposal.project_co_ordinator.strip().lower())
        if proposal.quotation_given_by_name and proposal.quotation_given_by_name.strip():
            names_to_check.add(proposal.quotation_given_by_name.strip().lower())

        if not names_to_check:
            return []

        users = db.query(User).filter(
            func.lower(User.name).in_(list(names_to_check))
        ).all()

        result = []
        for u in users:
            u_dict = self._serialize_model(u)
            # Remove sensitive credentials
            u_dict.pop("password", None)
            result.append(u_dict)

        return result

    # =========================================================================
    # SERIALIZATION UTILITY
    # =========================================================================

    def _serialize_model(self, model_obj: Any) -> Dict[str, Any]:
        """
        Converts a SQLAlchemy ORM model instance into a JSON-serializable dictionary.
        Handles date and datetime objects cleanly.
        """
        if not model_obj:
            return {}

        result = {}
        for attr in model_obj.__mapper__.column_attrs:
            key = attr.key
            val = getattr(model_obj, key)
            if isinstance(val, (datetime, date)):
                val = val.isoformat()
            result[key] = val

        return result


# Singleton Instance for global service injection
context_builder = ContextBuilder()

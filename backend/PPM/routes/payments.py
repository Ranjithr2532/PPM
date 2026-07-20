from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.requests import Request
from sqlalchemy.orm import Session
import base64
import json

from db import get_db
from models.model import Payment, Proposal, Stage
from pydantic_schema.request import PaymentCreate, PaymentUpdate
from pydantic_schema.response import PaymentResponse

router = APIRouter(prefix="/payments", tags=["Payments"])


def _extract_username_from_request(request: Request) -> Optional[str]:
    header_user = (
        request.headers.get('x-user-name')
        or request.headers.get('x-username')
        or request.headers.get('username')
        or request.headers.get('x-user')
        or request.headers.get('user')
    )
    header_user = header_user.strip() if header_user else None
    if header_user:
        return header_user

    auth = request.headers.get('authorization') or request.headers.get('Authorization')
    if not auth:
        return None

    parts = auth.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None

    token = parts[1]
    try:
        # Decode JWT payload without verification. Best-effort only.
        payload_b64 = token.split('.')[1]
        payload_b64 += '=' * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64.encode('utf-8')).decode('utf-8')
        claims = json.loads(payload_json)
        name = claims.get('name') or claims.get('username') or claims.get('email')
        return name.strip() if isinstance(name, str) and name.strip() else None
    except Exception:
        return None


# -------------------------------
# CREATE PAYMENT
# -------------------------------
@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreate, db: Session = Depends(get_db)
) -> PaymentResponse:

    # Validate project_id
    if payload.project_id is not None:
        project = db.query(Proposal).filter(Proposal.id == payload.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid project_id: {payload.project_id}"
            )

    # Validate stage_id
    if payload.stage_id is not None:
        stage = db.query(Stage).filter(Stage.id == payload.stage_id).first()
        if not stage:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid stage_id: {payload.stage_id}"
            )

    payment = Payment(**payload.dict(exclude_unset=True))
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


# -------------------------------
# LIST
# -------------------------------
@router.get("/", response_model=List[PaymentResponse])
def list_payments(db: Session = Depends(get_db)) -> List[PaymentResponse]:
    return db.query(Payment).all()


# -------------------------------
# GET BY ID
# -------------------------------
@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)) -> PaymentResponse:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    return payment


# -------------------------------
# UPDATE PAYMENT
# -------------------------------
@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    payload: PaymentUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> PaymentResponse:

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    update_data = payload.dict(exclude_unset=True)

    # Validate new project_id
    if "project_id" in update_data:
        pid = update_data["project_id"]
        if pid is not None:
            project = db.query(Proposal).filter(Proposal.id == pid).first()
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid project_id: {pid}"
                )

    # Validate new stage_id
    if "stage_id" in update_data:
        sid = update_data["stage_id"]
        if sid is not None:
            stage = db.query(Stage).filter(Stage.id == sid).first()
            if not stage:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid stage_id: {sid}"
                )

    for key, value in update_data.items():
        if key not in ['updated_at', 'updated_by']:
            setattr(payment, key, value)

    # Auto-set updated_at and updated_by when payment is edited
    payment.updated_at = datetime.utcnow()

    payload_user = update_data.get('updated_by')
    if payload_user:
        payment.updated_by = payload_user
    else:
        username = _extract_username_from_request(request)
        if username:
            payment.updated_by = username

    db.commit()
    db.refresh(payment)
    return payment


# -------------------------------
# DELETE PAYMENT
# -------------------------------
@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)) -> None:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    db.delete(payment)
    db.commit()

from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db import get_db
from models.model import Customer, Proposal
from pydantic_schema.customer_schema import (
    CustomerCreate,
    CustomerFromProposalResponse,
    CustomerResponse,
)

router = APIRouter(prefix="/customers", tags=["Customers"])


# CREATE CUSTOMER
@router.post("/", response_model=CustomerResponse)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    # Check if customer with same name already exists
    existing = db.query(Customer).filter(
        func.lower(Customer.name) == func.lower(customer.name.strip())
    ).first()

    if existing:
        raise HTTPException(400, f"Customer with name '{customer.name}' already exists")

    new_customer = Customer(**customer.dict())
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


# SEARCH CUSTOMERS BY NAME (partial match)
@router.get("/search", response_model=list[CustomerResponse])
def search_customers(
    name: str = Query(..., description="Customer name to search for (partial match)"),
    db: Session = Depends(get_db)
):
    if not name or not name.strip():
        return []

    # Case-insensitive partial match search
    search_pattern = f"%{name.strip()}%"
    customers = db.query(Customer).filter(
        Customer.name.ilike(search_pattern)
    ).order_by(Customer.name.asc()).limit(20).all()

    return customers


# GET ALL CUSTOMERS
@router.get("/", response_model=list[CustomerResponse])
def get_customers(db: Session = Depends(get_db)):
    """Return explicit customers, or fall back to unique customer entries extracted from proposals."""

    customers = db.query(Customer).order_by(Customer.name.asc()).all()
    if customers:
        return customers

    # Fallback: build customer list from proposals (when customer table is empty)
    proposals = db.query(Proposal).filter(Proposal.customer_name != None).all()

    customers_by_name: dict[str, dict] = {}
    for proposal in proposals:
        name = (proposal.customer_name or "").strip()
        if not name:
            continue

        if name not in customers_by_name:
            customers_by_name[name] = {
                "id": proposal.id or 0,
                "name": name,
                "customer_type": proposal.customer_type,
                "address": proposal.address,
                "email": proposal.email,
                "phone_no": proposal.phone_no,
                "alternate_contact_details": proposal.alternate_contact_details,
                "created_at": proposal.created_at,
                "updated_at": proposal.updated_at,
            }

    # Return values in alphabetical order by name
    return sorted(customers_by_name.values(), key=lambda c: c["name"].lower())


# GET CUSTOMERS FROM PROPOSALS
@router.get("/from-proposals", response_model=List[CustomerFromProposalResponse])
def get_customers_from_proposals(db: Session = Depends(get_db)):
    """Return unique customers derived from proposal records, including all known addresses."""

    proposals = db.query(Proposal).filter(Proposal.customer_name != None).all()
    by_name: dict[str, dict] = {}

    for proposal in proposals:
        name = (proposal.customer_name or "").strip()
        if not name:
            continue

        entry = by_name.setdefault(name, {
            "name": name,
            "customer_type": proposal.customer_type,
            "email": proposal.email,
            "phone_no": proposal.phone_no,
            "alternate_contact_details": proposal.alternate_contact_details,
            "addresses": set(),
        })

        if proposal.address:
            entry["addresses"].add(proposal.address)

    return [
        {
            **{k: v for k, v in entry.items() if k != "addresses"},
            "addresses": sorted(entry["addresses"]),
        }
        for entry in by_name.values()
    ]


# GET CUSTOMER ADDRESSES (from proposals)
@router.get("/addresses", response_model=List[str])
def get_customer_addresses(
    name: str = Query(..., description="Customer name to fetch addresses for"),
    db: Session = Depends(get_db),
):
    """Return all addresses seen for the given customer name (based on proposals)."""

    name = name.strip()
    if not name:
        return []

    proposals = (
        db.query(Proposal)
        .filter(func.lower(Proposal.customer_name) == func.lower(name))
        .all()
    )

    addresses = {p.address for p in proposals if p.address and p.address.strip()}
    return sorted(addresses)


# GET SINGLE CUSTOMER
@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


# UPDATE CUSTOMER
@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, data: CustomerCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return customer


# DELETE CUSTOMER
@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted successfully"}

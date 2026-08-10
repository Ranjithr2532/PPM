import json
from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db import get_db
from models.model import Customers
from pydantic_schema.customer1_schema import (
    Customer1Create,
    Customer1Response,
    Customer1Update,
)

router = APIRouter(prefix="/customer1", tags=["Customer1"])


def clean_list_item(item):
    if isinstance(item, dict):
        return str(item.get("value") or item.get("address") or next(iter(item.values())) or "")
    return str(item)


def to_response(cust):
    if not cust:
        return None
        
    def parse_list_field(val):
        if not val:
            return []
        if isinstance(val, list):
            return [clean_list_item(i) for i in val]
        if isinstance(val, str):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return [clean_list_item(i) for i in parsed]
                return [clean_list_item(parsed)]
            except Exception:
                delimiters = [',', ';', '\n']
                parts = [val]
                for d in delimiters:
                    parts = [p for part in parts for p in part.split(d)]
                return [p.strip() for p in parts if p.strip()]
        return [clean_list_item(val)]

    return {
        "id": cust.id,
        "name": cust.name,
        "customer_type": cust.customer_type,
        "email": parse_list_field(cust.email),
        "phone": parse_list_field(cust.phone),
        "address": parse_list_field(cust.address),
        "alternate_contact_details": parse_list_field(cust.alternate_contact_details),
        "gst": parse_list_field(cust.gst),
        "pan": parse_list_field(cust.pan),
        "tan": parse_list_field(cust.tan),
        "created_at": cust.created_at,
        "updated_at": cust.updated_at,
    }


# CREATE CUSTOMER
@router.post("/", response_model=Customer1Response)
def create_customer(customer: Customer1Create, db: Session = Depends(get_db)):
    # Check if customer with same name already exists
    existing = db.query(Customers).filter(
        func.lower(Customers.name) == func.lower(customer.name.strip())
    ).first()

    if existing:
        raise HTTPException(400, f"Customer with name '{customer.name}' already exists")

    data = customer.dict()
    for field in ['gst', 'pan', 'tan']:
        if isinstance(data.get(field), list):
            data[field] = json.dumps(data[field])

    new_customer = Customers(**data)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return to_response(new_customer)


# SEARCH CUSTOMERS BY NAME (partial match)
@router.get("/search", response_model=list[Customer1Response])
def search_customers(
    name: str = Query(..., description="Customer name to search for (partial match)"),
    db: Session = Depends(get_db)
):
    if not name or not name.strip():
        return []

    # Case-insensitive partial match search
    search_pattern = f"%{name.strip()}%"
    customers = db.query(Customers).filter(
        Customers.name.ilike(search_pattern)
    ).order_by(Customers.name.asc()).limit(20).all()

    return [to_response(c) for c in customers]


# GET ALL CUSTOMERS
@router.get("/", response_model=list[Customer1Response])
def get_customers(db: Session = Depends(get_db)):
    customers = db.query(Customers).order_by(Customers.name.asc()).all()
    return [to_response(c) for c in customers]


# GET SINGLE CUSTOMER
@router.get("/{customer_id}", response_model=Customer1Response)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customers).filter(Customers.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    return to_response(customer)


# UPDATE CUSTOMER
@router.put("/{customer_id}", response_model=Customer1Response)
def update_customer(customer_id: int, data: Customer1Update, db: Session = Depends(get_db)):
    customer = db.query(Customers).filter(Customers.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    data_dict = data.dict(exclude_unset=True)
    for field in ['gst', 'pan', 'tan']:
        if field in data_dict and isinstance(data_dict[field], list):
            data_dict[field] = json.dumps(data_dict[field])

    for key, value in data_dict.items():
        setattr(customer, key, value)

    db.commit()
    db.refresh(customer)
    return to_response(customer)


# DELETE CUSTOMER
@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customers).filter(Customers.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted successfully"}

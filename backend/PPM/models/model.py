from sqlalchemy import Column, DateTime, ARRAY, ForeignKey, Integer, String, func , Boolean , TIMESTAMP, JSON, Numeric
from sqlalchemy.orm import relationship
from db import Base
from datetime import datetime



# -------------------------------------------------
# PROPOSAL TABLE
# -------------------------------------------------
class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    enquiry_date = Column(String, nullable=True)
    customer_type = Column(String, nullable=True)
    customer_name = Column(String , nullable= True)
    address = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone_no = Column(String, nullable=True)
    alternate_contact_details = Column(String, nullable=True)
    request_type = Column(String, nullable=True)
    email_reference = Column(String, nullable=True)
    quote_reference = Column(String, nullable=True)
    quote_description = Column(String, nullable=True)
    quote_date = Column(String, nullable=True)
    quote_amount = Column(String, nullable=True)
    proposal_status = Column(String, nullable=True)

    revised_negotiated = Column("revised/negotiated", String, nullable=True)
    revised_negotiated_quote_date = Column("revised/negotiated_quote_date", String, nullable=True)
    revised_negotiated_quote_amount = Column("revised/negotiated_quote_amount", String, nullable=True)

    quotation_given_by_name = Column(String, nullable=True)
    quotation_given_by_department = Column(String, nullable=True)
    project_number = Column(String, nullable=True)
    party_name = Column(String, nullable=True)
    activity = Column(String, nullable=True)
    key_deliverables = Column(String, nullable=True)
    order_number = Column(String, nullable=True)
    order_date = Column(String, nullable=True)
    delivery_date = Column(String, nullable=True)
    extended_delivery_date = Column(String, nullable=True)
    date_of_actual_commencement = Column(String, nullable=True)
    order_value = Column(String, nullable=True)
    details_of_external_internal_review_meeting = Column(String, nullable=True)
    project_co_ordinator = Column(String, nullable=True)
    center = Column(String, nullable=True)
    co_ordinator_remarks = Column(String, nullable=True)
    closer_report = Column(String, nullable=True)
    technical_completed_year = Column(String, nullable=True)
    financial_completed_year = Column(String, nullable=True)
    dispatch_date = Column(String, nullable=True)
    project_allotment_date = Column(String, nullable=True)
    review_meeting_date = Column(String, nullable=True)
    small_value_project = Column(String, nullable=True)
    ppm_remarks = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)

    group = Column(String, nullable=True)
    is_acknowledged = Column(Boolean , nullable= True)
    status = Column(String, nullable=True)
    proposals_converted = Column(String, nullable=True)
    if_not_reason = Column(String, nullable=True)


    # Child relationships
    documents = relationship("Document", back_populates="proposal", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="proposal", cascade="all, delete-orphan")
    progress_entries = relationship("Progress", back_populates="proposal", cascade="all, delete-orphan")
class Remarks(Base):
    __tablename__ = "remarks"  

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Sender & Recipient Information
    from_ = Column("from_", String, nullable=True)
    to = Column(String, nullable=True)

    # Associated Proposal/Project
    project_id = Column(Integer, nullable=True)

    # Message Content & Sent Timestamp
    remarks_description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=False), default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime(timezone=False), onupdate=datetime.utcnow, nullable=True)

    # Message Delivery & Read Status (WhatsApp Style: Sent -> Delivered -> Read)
    is_delivered = Column(Boolean, nullable=False, default=True, server_default='true')
    delivered_at = Column(DateTime(timezone=False), nullable=True)
    message_seen = Column(Boolean, nullable=False, default=False, server_default='false')
    message_seen_at = Column(DateTime(timezone=False), nullable=True)

    # Reply Details & Replyer Info
    respond_to_remarks = Column(String, nullable=True)
    replyer = Column(String, nullable=True)
    replied_at = Column(DateTime(timezone=False), nullable=True)

    # Reply Read Status (WhatsApp Style Read Receipts for Reply)
    reply_delivered = Column(Boolean, nullable=False, default=True, server_default='true')
    reply_delivered_at = Column(DateTime(timezone=False), nullable=True)
    reply_seen = Column(Boolean, nullable=False, default=False, server_default='false')
    reply_seen_at = Column(DateTime(timezone=False), nullable=True)

class ProjectPaymentStages(Base):
    __tablename__ = "project_payment_stages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    name = Column(String, nullable=True)
    project_no = Column(String, nullable=True)
    value = Column(String, nullable=True)
    status = Column(String, nullable=True)
    invoice_details = Column(String, nullable=True)
    invoice_status = Column(String, nullable=True)
# -------------------------------------------------
# STAGE TABLE
# -------------------------------------------------
class Stage(Base):
    __tablename__ = "stages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=True)
    position = Column(Integer, nullable=False)
    access = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)


# -------------------------------------------------
# DOCUMENT TABLE
# -------------------------------------------------
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=True)
    description = Column(String, nullable=True)
    url = Column(String, nullable=True)
    version = Column(String, nullable=True)
    #attachment = Column(JSONB, nullable=True) 
    attachment = Column(ARRAY(String), nullable=True) 

    project_id = Column(Integer, ForeignKey("proposals.id", ondelete="CASCADE"))
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"))
    uploaded_by = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)

    proposal = relationship("Proposal", back_populates="documents")
    stage = relationship("Stage")


# -------------------------------------------------
# PAYMENT TABLE
# -------------------------------------------------
class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    invoice_no = Column(String, nullable=True)
    invoice_date = Column(String, nullable=True)
    gross_amount = Column(String, nullable=True)
    get_amount = Column(String, nullable=True)
    amount_claimed = Column(String, nullable=True)
    amount_recieved = Column(String, nullable=True)
    recieved_date = Column(String, nullable=True)
    tds = Column(String, nullable=True)
    get_tds = Column(String, nullable=True)
    ld = Column(String, nullable=True)
    bal = Column(String, nullable=True)
    
    follow_up_status = Column(String, nullable=True)

    project_id = Column(Integer, ForeignKey("proposals.id", ondelete="CASCADE"))
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"))

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)
    updated_by = Column(String, nullable=True)
    
    

    proposal = relationship("Proposal", back_populates="payments")
    stage = relationship("Stage")


# -------------------------------------------------
# PROGRESS TABLE
# -------------------------------------------------
class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    remarks = Column(String, nullable=True)

    project_id = Column(Integer, ForeignKey("proposals.id", ondelete="CASCADE"))
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"))

    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)

    proposal = relationship("Proposal", back_populates="progress_entries")
    stage = relationship("Stage")


# -------------------------------------------------
# CENTRE TABLE
# -------------------------------------------------
class Centre(Base):
    __tablename__ = "centres"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    head = Column(String, nullable=True)
    code = Column(String, unique=True, nullable=False)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)

    groups = relationship("Group", back_populates="centre", cascade="all, delete-orphan")


# -------------------------------------------------
# GROUP TABLE
# -------------------------------------------------
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    head = Column(String, nullable=True)
    code = Column(String, nullable=False)

    centre_id = Column(Integer, ForeignKey("centres.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)

    centre = relationship("Centre", back_populates="groups")



class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_name = Column(String, nullable=False)  # admin OR project-coordinator
    message = Column(String, nullable=False)
    is_read = Column(Integer, default=0)  # 0 = unread, 1 = read
    related_proposal_id = Column(Integer, ForeignKey("proposals.id", ondelete="CASCADE"), nullable=True)
    related_document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    trigerred_by = Column(String , nullable = True)

# -------------------------------------------------
# MASTER PROPOSAL TABLE
# -------------------------------------------------
class MasterProposal(Base):
    __tablename__ = "master_proposals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    quote_date = Column(String, nullable=True)
    customer_name = Column(String, nullable=True)
    description = Column(String, nullable=True)
    quote_amt = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    quotation_ref = Column(String, nullable=True)
    indentor = Column(String, nullable=True)
    department = Column(String, nullable=True)
    contact_details = Column(String, nullable=True)
    order_number = Column(String, nullable=True)
    date = Column(String, nullable=True)
    amount = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)


class OTP(Base):
    __tablename__ = 'otp'

    id = Column(Integer, primary_key=True)
    email = Column(String)
    otp_code = Column(String)
    created_at = Column(TIMESTAMP(timezone=False), default=func.now())
    expires_at = Column(TIMESTAMP(timezone=False))
    is_used = Column(Boolean, default=False)


# -------------------------------------------------
# CUSTOMER TABLE
# -------------------------------------------------
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    customer_type = Column(String, nullable=True)
    gst = Column(String, nullable=True)
    pan = Column(String, nullable=True)
    tan = Column(String, nullable=True)
    address = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone_no = Column(String, nullable=True)
    alternate_contact_details = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)
    


class DynamicTable(Base):
    __tablename__ = "dynamic_tables"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)   # version number per project (1, 2, 3 ...)
    header_name = Column(String, nullable=False)
    columns = Column(JSON, nullable=False)
    rows = Column(JSON, nullable=False)  # raw, editable rows - NOT computed/display rows
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False)
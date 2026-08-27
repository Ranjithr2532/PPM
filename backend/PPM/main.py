from routes.manpower import router as manpower_router
from routes.iso_submission import router as iso_submission_router
from routes.iso_document_list import router as iso_document_list_router


from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware
from routes import masterproposals 
from db import Base, engine

# ✅ IMPORT ALL MODELS SO SQLALCHEMY CAN CREATE TABLES
from models import model          # proposals, documents, payments, etc.
from models import user_model     # ⬅️ VERY IMPORTANT (creates users table)

# Security authentication dependency
from security.auth import get_current_user

# Routers
from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.payments import router as payments_router
from routes.progress import router as progress_router
from routes.proposals import router as proposals_router
from routes.stages import router as stages_router
from routes.user import router as user_router   # user router
from routes.centres import router as centres_router
from routes.groups import router as groups_router
from routes.masterproposals import router as master_proposals_router
from routes.notification import router as notification_router
from routes.customers import router as customers_router
from routes.customer1 import router as customer1_router
from routes.remarksroutes import router as remarks_router
from routes.projectpayment import router as project_payments_router
from routes.acknowledgment import router as acknowledgment_router
from routes.dynamic_table import router as dynamic_table_router
from routes.groupchatroutes import router as groupchat_router
from routes.count import router as count_router
from routes.quotation import router as quotation_router, proposal_alias_router, proposal_lc_alias_router
from iso.header import router as iso_header_router
from iso.finalfooter import router as iso_footer_router
from iso.fesiablity import router as iso_feasibility_router
from iso.contractreview import router as iso_contractreview_router
from iso.projectteam import router as iso_projectteam_router
from iso.mom import router as iso_mom_router
from iso.quation_reader import router as iso_quotation_reader_router
from iso.projectpropsasl import router as iso_projectpropsasl_router
from iso.projectplan import router as iso_projectplan_router
from iso.sqap import router as iso_sqap_router
from iso.bom import router as iso_bom_router
from iso.drawingregister import router as iso_drawing_register_router
from routes.email_extraction import router as email_extraction_router
# from ai_routes.ai import router as ai_router



from sqlalchemy import text

# Create all tables
Base.metadata.create_all(bind=engine)

# Ensure new columns exist on proposals and customer1 tables
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE proposals ADD COLUMN IF NOT EXISTS make_in_india VARCHAR;"))
        conn.execute(text("ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tender_images VARCHAR;"))
        conn.execute(text("ALTER TABLE customer1 ADD COLUMN IF NOT EXISTS customer_type VARCHAR;"))
        conn.execute(text("ALTER TABLE customer1 ADD COLUMN IF NOT EXISTS gst TEXT;"))
        conn.execute(text("ALTER TABLE customer1 ADD COLUMN IF NOT EXISTS pan TEXT;"))
        conn.execute(text("ALTER TABLE customer1 ADD COLUMN IF NOT EXISTS tan TEXT;"))
        conn.execute(text("ALTER TABLE customer1 ADD COLUMN IF NOT EXISTS alternate_contact_details JSON;"))
        conn.commit()
except Exception as e:
    print(f"Migration error: {e}")


app = FastAPI(title="Order Management Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Public Routers (No Auth Required)
# --------------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(count_router)
app.include_router(quotation_router)
app.include_router(proposal_alias_router)
app.include_router(proposal_lc_alias_router)
app.include_router(iso_header_router)
app.include_router(iso_footer_router)
app.include_router(iso_feasibility_router)
app.include_router(iso_contractreview_router)
app.include_router(iso_projectteam_router)
app.include_router(iso_mom_router)
app.include_router(iso_submission_router)
app.include_router(iso_document_list_router)
app.include_router(iso_quotation_reader_router)
app.include_router(iso_projectpropsasl_router)
app.include_router(iso_projectplan_router)
app.include_router(iso_sqap_router)
app.include_router(iso_bom_router)
app.include_router(iso_drawing_register_router)
app.include_router(email_extraction_router)




# app.include_router(ai_router)

# --------------------------------------------------------------------------
# Protected Routers (Require Valid JWT Access Token)
# --------------------------------------------------------------------------
jwt_auth = [Depends(get_current_user)]

app.include_router(proposals_router, dependencies=jwt_auth)
app.include_router(stages_router, dependencies=jwt_auth)
app.include_router(payments_router, dependencies=jwt_auth)
app.include_router(documents_router, dependencies=jwt_auth)
app.include_router(progress_router, dependencies=jwt_auth)
app.include_router(centres_router, dependencies=jwt_auth)
app.include_router(groups_router, dependencies=jwt_auth)
app.include_router(master_proposals_router, dependencies=jwt_auth)
app.include_router(notification_router, dependencies=jwt_auth)
app.include_router(customers_router, dependencies=jwt_auth)
app.include_router(customer1_router, dependencies=jwt_auth)
app.include_router(remarks_router, dependencies=jwt_auth)
app.include_router(project_payments_router, dependencies=jwt_auth)
app.include_router(acknowledgment_router, dependencies=jwt_auth)
app.include_router(dynamic_table_router, dependencies=jwt_auth)
app.include_router(groupchat_router, dependencies=jwt_auth)
app.include_router(count_router, dependencies=jwt_auth)
app.include_router(manpower_router, dependencies=jwt_auth)


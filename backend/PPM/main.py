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
from routes.remarksroutes import router as remarks_router
from routes.projectpayment import router as project_payments_router
from routes.acknowledgment import router as acknowledgment_router
from routes.dynamic_table import router as dynamic_table_router
from routes.groupchatroutes import router as groupchat_router
from routes.count import router as count_router

# Create all tables
Base.metadata.create_all(bind=engine)


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
app.include_router(remarks_router, dependencies=jwt_auth)
app.include_router(project_payments_router, dependencies=jwt_auth)
app.include_router(acknowledgment_router, dependencies=jwt_auth)
app.include_router(dynamic_table_router, dependencies=jwt_auth)
app.include_router(groupchat_router, dependencies=jwt_auth)
app.include_router(count_router, dependencies=jwt_auth)


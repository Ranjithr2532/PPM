from fastapi import FastAPI
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware
from routes import masterproposals 
from db import Base, engine

# ✅ IMPORT ALL MODELS SO SQLALCHEMY CAN CREATE TABLES
from models import model          # proposals, documents, payments, etc.
from models import user_model     # ⬅️ VERY IMPORTANT (creates users table)

# Routers
from routes.documents import router as documents_router
from routes.payments import router as payments_router
from routes.progress import router as progress_router
from routes.proposals import router as proposals_router
from routes.stages import router as stages_router
from routes.user import router as user_router   # new user router
from routes.centres import router as centres_router
from routes.groups import router as groups_router
from routes.masterproposals import router as master_proposals_router
from routes.notification import router as notification_router
from routes.customers import router as customers_router
from routes.remarksroutes import router as remarks_router
from routes.projectpayment import router as project_payments_router
from routes.acknowledgment import router as acknowledgment_router
from routes.dynamic_table import router as dynamic_table_router

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

# Existing routers
app.include_router(proposals_router)
app.include_router(stages_router)
app.include_router(payments_router)
app.include_router(documents_router)
app.include_router(progress_router)

# New User router
app.include_router(user_router)

app.include_router(centres_router)
app.include_router(groups_router)
app.include_router(master_proposals_router)
app.include_router(notification_router)
app.include_router(customers_router)
app.include_router(remarks_router)
app.include_router(project_payments_router)
app.include_router(acknowledgment_router)
app.include_router(dynamic_table_router)
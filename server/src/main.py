import logging
from contextlib import asynccontextmanager

# Configure app-level logging so voice/whisper logs appear in the console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)

from fastapi import FastAPI

from db import Base, engine
from models import BillingEvent, EmailVerificationCode, FinancialRecord, Organization, OrganizationBilling, OrganizationUser, Property, Renter, Unit, User
from routers import auth, organizations, properties, units, renters, financial_records, voice, billing, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Rentzu API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
app.include_router(properties.router, prefix="/properties", tags=["properties"])
app.include_router(units.router, prefix="/units", tags=["units"])
app.include_router(renters.router, prefix="/renters", tags=["renters"])
app.include_router(financial_records.router, prefix="/financial-records", tags=["financial-records"])
app.include_router(voice.router, prefix="/voice", tags=["voice"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])


@app.get("/")
def root():
    return {"ok": True, "service": "rentzu-api"}

"""src/db/seed.py — Deterministic seed data for local development and integration tests.

Seeds standard test users and vetted generic shipbroker profiles.
Does NOT fabricate commercial real-world quotes or proprietary company names.
"""
from __future__ import annotations

import logging
from sqlalchemy.orm import Session

from .models import User, UserRole, AccountStatus, Broker
from .session import SessionLocal

logger = logging.getLogger(__name__)

INITIAL_USERS = [
    {
        "id": "user-sail-buyer-001",
        "name": "Ankit Sharma",
        "email": "ankit.sharma@sail-procurement.in",
        "role": UserRole.USER,
        "account_status": AccountStatus.ACTIVE,
        "company_name": "Steel Authority of India Ltd (SAIL) — Raw Material Division",
    },
    {
        "id": "user-sail-analyst-002",
        "name": "Priya Patel",
        "email": "priya.patel@sail-procurement.in",
        "role": UserRole.USER,
        "account_status": AccountStatus.ACTIVE,
        "company_name": "SAIL Commercial Intelligence Desk",
    },
    {
        "id": "admin-navik-ops-001",
        "name": "NAVIK Operations Chief",
        "email": "ops.admin@navik.maritime",
        "role": UserRole.ADMIN,
        "account_status": AccountStatus.ACTIVE,
        "company_name": "NAVIK Maritime Operations Command",
    },
]

INITIAL_BROKERS = [
    {
        "id": "broker-east-coast-001",
        "company_name": "Oceanic Bulk Chartering Ltd",
        "contact_person": "Capt. H. Campbell",
        "email": "fixtures@oceanicbulk.example.com",
        "phone": "+65 6789 0123",
        "country": "Singapore",
        "geographic_coverage": ["Australia", "Indonesia", "India East Coast", "South Africa"],
        "vessel_segments": ["Capesize", "Newcastlemax", "Panamax"],
        "company_description": "Specialised in deep-draft raw-material dry bulk stems into Paradip, Dhamra, and Gangavaram.",
        "is_active": True,
    },
    {
        "id": "broker-singapore-002",
        "company_name": "Straits Maritime Broking Pte Ltd",
        "contact_person": "Lin Wei",
        "email": "chartering@straitsmaritime.example.com",
        "phone": "+65 6543 2100",
        "country": "Singapore",
        "geographic_coverage": ["Singapore", "Southeast Asia", "Bay of Bengal", "Australia"],
        "vessel_segments": ["Supramax", "Ultramax", "Handysize"],
        "company_description": "Regional feeder and geared vessel specialist for mid-size bulk shipments and coastal lightering.",
        "is_active": True,
    },
    {
        "id": "broker-subcontinent-003",
        "company_name": "Bengal Sea Charterers",
        "contact_person": "R. Sengupta",
        "email": "desk@bengalsea.example.com",
        "phone": "+91 33 2211 4455",
        "country": "India",
        "geographic_coverage": ["India East Coast", "Sri Lanka", "Indonesia", "Oman"],
        "vessel_segments": ["Panamax", "Capesize"],
        "company_description": "Dedicated Indian subcontinent discharge coordinator with direct links to domestic steel terminal operators.",
        "is_active": True,
    },
]


def seed_database(db: Session | None = None) -> dict[str, int]:
    """Seed initial users and brokers idempotently."""
    close_at_end = False
    if db is None:
        db = SessionLocal()
        close_at_end = True

    users_added = 0
    brokers_added = 0

    try:
        # 1. Seed Users
        for u_data in INITIAL_USERS:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                user = User(**u_data)
                db.add(user)
                users_added += 1

        # 2. Seed Brokers
        for b_data in INITIAL_BROKERS:
            existing = db.query(Broker).filter(Broker.company_name == b_data["company_name"]).first()
            if not existing:
                broker = Broker(**b_data)
                db.add(broker)
                brokers_added += 1

        db.commit()
        logger.info("Database seeding complete: %d users added, %d brokers added.", users_added, brokers_added)
        return {"users_added": users_added, "brokers_added": brokers_added}
    except Exception as exc:
        db.rollback()
        logger.error("Failed to seed database: %s", exc)
        raise
    finally:
        if close_at_end:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_database()


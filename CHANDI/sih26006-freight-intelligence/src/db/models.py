"""src/db/models.py — SQLAlchemy declarative data models for Chartering Operations.

Defines the core relational schema for NAVIK's broker-assisted chartering workflow:
  1. User
  2. CharterRequest (RFQ)
  3. Broker
  4. BrokerAssignment
  5. BrokerOffer (Quotation)
  6. Fixture
  7. RequestStatusHistory
  8. AuditLog
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from .session import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════

class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class AccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class CharterRequestStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    READY_FOR_BROKER = "READY_FOR_BROKER"
    BROKER_ASSIGNED = "BROKER_ASSIGNED"
    QUOTES_PENDING = "QUOTES_PENDING"
    OFFERS_RECEIVED = "OFFERS_RECEIVED"
    NEGOTIATION = "NEGOTIATION"
    TERMS_AGREED = "TERMS_AGREED"
    FIXTURE_CONFIRMED = "FIXTURE_CONFIRMED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class CharterType(str, enum.Enum):
    SPOT = "SPOT"
    COA = "COA"
    TIME_CHARTER = "TIME_CHARTER"


class AssignmentStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    ENQUIRY_SENT = "ENQUIRY_SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class OfferStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    PRESENTED_TO_USER = "PRESENTED_TO_USER"
    ACCEPTED = "ACCEPTED"
    REVISED = "REVISED"
    EXPIRED = "EXPIRED"
    REJECTED = "REJECTED"


class FixtureStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    CANCELLED_DEFAULT = "CANCELLED_DEFAULT"


# ═══════════════════════════════════════════════════════════════════════════
# 1. USER
# ═══════════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    account_status = Column(
        Enum(AccountStatus, name="account_status_enum", native_enum=False),
        default=AccountStatus.ACTIVE,
        nullable=False,
    )
    role = Column(
        Enum(UserRole, name="user_role_enum", native_enum=False),
        default=UserRole.USER,
        index=True,
        nullable=False,
    )
    company_name = Column(String(150), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    google_sub = Column(String(100), nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Prepared for future fallback auth

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    charter_requests = relationship("CharterRequest", back_populates="user", cascade="all, delete-orphan")
    assigned_broker_links = relationship("BrokerAssignment", back_populates="assigned_by_admin")
    status_changes = relationship("RequestStatusHistory", back_populates="changed_by_user")
    fixtures_confirmed = relationship("Fixture", back_populates="confirmed_by_admin")
    audit_logs = relationship("AuditLog", back_populates="actor")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


# ═══════════════════════════════════════════════════════════════════════════
# 2. CHARTER REQUEST / RFQ
# ═══════════════════════════════════════════════════════════════════════════

class CharterRequest(Base):
    __tablename__ = "charter_requests"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    reference = Column(String(32), unique=True, index=True, nullable=False)  # e.g., NAV-RFQ-000001
    user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)

    cargo_type = Column(String(50), nullable=False)
    commodity_desc = Column(Text, nullable=True)
    quantity_mt = Column(Numeric(14, 2), nullable=False)

    origin_port = Column(String(10), index=True, nullable=False)
    destination_port = Column(String(10), index=True, nullable=False)
    origin_country = Column(String(60), nullable=True)
    destination_country = Column(String(60), nullable=True)

    vessel_class = Column(String(30), index=True, nullable=False)
    charter_type = Column(
        Enum(CharterType, name="charter_type_enum", native_enum=False),
        default=CharterType.SPOT,
        nullable=False,
    )

    laycan_start = Column(Date, nullable=False)
    laycan_end = Column(Date, nullable=False)

    loading_rate_mt_day = Column(Numeric(10, 2), nullable=True)
    discharge_rate_mt_day = Column(Numeric(10, 2), nullable=True)
    additional_cargo_reqs = Column(Text, nullable=True)
    additional_commercial_instructions = Column(Text, nullable=True)

    source_optimization_result_id = Column(String(64), index=True, nullable=True)

    status = Column(
        Enum(CharterRequestStatus, name="charter_request_status_enum", native_enum=False),
        default=CharterRequestStatus.SUBMITTED,
        index=True,
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("quantity_mt > 0", name="chk_charter_req_quantity_positive"),
        CheckConstraint("laycan_end >= laycan_start", name="chk_charter_req_laycan_order"),
    )

    # Relationships
    user = relationship("User", back_populates="charter_requests")
    assignments = relationship("BrokerAssignment", back_populates="request", cascade="all, delete-orphan")
    offers = relationship("BrokerOffer", back_populates="request", cascade="all, delete-orphan")
    fixture = relationship("Fixture", back_populates="request", uselist=False)
    status_history = relationship(
        "RequestStatusHistory",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="RequestStatusHistory.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<CharterRequest(id={self.id}, ref={self.reference}, status={self.status})>"


# ═══════════════════════════════════════════════════════════════════════════
# 3. BROKER
# ═══════════════════════════════════════════════════════════════════════════

class Broker(Base):
    __tablename__ = "brokers"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    company_name = Column(String(150), unique=True, index=True, nullable=False)
    contact_person = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    country = Column(String(60), nullable=False)

    geographic_coverage = Column(JSON, nullable=True)  # List[str], e.g. ["Australia", "Indonesia", "India East Coast"]
    vessel_segments = Column(JSON, nullable=True)      # List[str], e.g. ["Capesize", "Newcastlemax", "Panamax"]
    company_description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    assignments = relationship("BrokerAssignment", back_populates="broker", cascade="all, delete-orphan")
    offers = relationship("BrokerOffer", back_populates="broker")
    fixtures = relationship("Fixture", back_populates="broker")

    def __repr__(self) -> str:
        return f"<Broker(id={self.id}, company={self.company_name}, active={self.is_active})>"


# ═══════════════════════════════════════════════════════════════════════════
# 4. BROKER ASSIGNMENT
# ═══════════════════════════════════════════════════════════════════════════

class BrokerAssignment(Base):
    __tablename__ = "broker_assignments"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    rfq_id = Column(String(36), ForeignKey("charter_requests.id", ondelete="CASCADE"), index=True, nullable=False)
    broker_id = Column(String(36), ForeignKey("brokers.id", ondelete="RESTRICT"), index=True, nullable=False)
    assigned_by_admin_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    assignment_status = Column(
        Enum(AssignmentStatus, name="assignment_status_enum", native_enum=False),
        default=AssignmentStatus.ASSIGNED,
        index=True,
        nullable=False,
    )

    enquiry_sent_at = Column(DateTime(timezone=True), nullable=True)
    response_deadline = Column(DateTime(timezone=True), nullable=True)
    internal_notes = Column(Text, nullable=True)  # STRICTLY Admin-only internal remarks

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("rfq_id", "broker_id", name="uq_rfq_broker_assignment"),
    )

    # Relationships
    request = relationship("CharterRequest", back_populates="assignments")
    broker = relationship("Broker", back_populates="assignments")
    assigned_by_admin = relationship("User", back_populates="assigned_broker_links")
    offers = relationship("BrokerOffer", back_populates="assignment")

    def __repr__(self) -> str:
        return f"<BrokerAssignment(id={self.id}, rfq={self.rfq_id}, broker={self.broker_id}, status={self.assignment_status})>"


# ═══════════════════════════════════════════════════════════════════════════
# 5. BROKER OFFER / QUOTATION
# ═══════════════════════════════════════════════════════════════════════════

class BrokerOffer(Base):
    __tablename__ = "broker_offers"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    rfq_id = Column(String(36), ForeignKey("charter_requests.id", ondelete="CASCADE"), index=True, nullable=False)
    broker_id = Column(String(36), ForeignKey("brokers.id", ondelete="RESTRICT"), index=True, nullable=False)
    assignment_id = Column(String(36), ForeignKey("broker_assignments.id", ondelete="SET NULL"), nullable=True)
    parent_offer_id = Column(String(36), ForeignKey("broker_offers.id", ondelete="SET NULL"), nullable=True)

    revision_number = Column(Integer, default=1, nullable=False)
    offered_vessel_name = Column(String(120), nullable=False)
    imo_number = Column(String(10), index=True, nullable=True)
    mmsi_number = Column(String(15), nullable=True)
    vessel_class = Column(String(30), nullable=False)

    deadweight_tonnage = Column(Numeric(12, 2), nullable=True)
    vessel_capacity_cbm = Column(Numeric(12, 2), nullable=True)

    freight_rate = Column(Numeric(14, 4), nullable=False)
    freight_rate_unit = Column(String(20), default="USD_PER_MT", nullable=False)  # USD_PER_MT, USD_PER_DAY, LUMPSUM
    currency = Column(String(5), default="USD", nullable=False)
    charter_type = Column(String(30), default="VOYAGE", nullable=False)

    laycan_start = Column(Date, nullable=False)
    laycan_end = Column(Date, nullable=False)

    loading_rate_mt_day = Column(Numeric(10, 2), nullable=True)
    discharge_rate_mt_day = Column(Numeric(10, 2), nullable=True)
    demurrage_rate_usd_day = Column(Numeric(12, 2), nullable=True)
    despatch_terms = Column(Text, nullable=True)
    other_commercial_terms = Column(Text, nullable=True)

    validity_deadline = Column(DateTime(timezone=True), nullable=False)
    broker_remarks = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)  # STRICTLY Admin-only internal notes

    offer_status = Column(
        Enum(OfferStatus, name="offer_status_enum", native_enum=False),
        default=OfferStatus.SUBMITTED,
        index=True,
        nullable=False,
    )

    attachment_doc_ref = Column(String(255), nullable=True)
    received_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("freight_rate >= 0", name="chk_broker_offer_rate_non_negative"),
        CheckConstraint("laycan_end >= laycan_start", name="chk_broker_offer_laycan_order"),
    )

    # Relationships
    request = relationship("CharterRequest", back_populates="offers")
    broker = relationship("Broker", back_populates="offers")
    assignment = relationship("BrokerAssignment", back_populates="offers")
    revisions = relationship("BrokerOffer", backref="parent_offer", remote_side=[id])
    fixture = relationship("Fixture", back_populates="offer", uselist=False)

    def __repr__(self) -> str:
        return f"<BrokerOffer(id={self.id}, vessel={self.offered_vessel_name}, rate={self.freight_rate} {self.currency}, status={self.offer_status})>"


# ═══════════════════════════════════════════════════════════════════════════
# 6. FIXTURE (CONFIRMED FIXTURE)
# ═══════════════════════════════════════════════════════════════════════════

class Fixture(Base):
    __tablename__ = "fixtures"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    rfq_id = Column(String(36), ForeignKey("charter_requests.id", ondelete="RESTRICT"), unique=True, index=True, nullable=False)
    accepted_offer_id = Column(String(36), ForeignKey("broker_offers.id", ondelete="RESTRICT"), unique=True, index=True, nullable=False)
    broker_id = Column(String(36), ForeignKey("brokers.id", ondelete="RESTRICT"), index=True, nullable=False)
    confirmed_by_admin_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    confirmed_vessel_name = Column(String(120), nullable=False)
    imo_number = Column(String(10), nullable=True)
    mmsi_number = Column(String(15), nullable=True)
    shipowner = Column(String(150), nullable=True)
    vessel_class = Column(String(30), nullable=False)

    cargo_quantity_mt = Column(Numeric(14, 2), nullable=False)
    origin_port = Column(String(10), nullable=False)
    destination_port = Column(String(10), nullable=False)

    final_freight_rate = Column(Numeric(14, 4), nullable=False)
    freight_rate_unit = Column(String(20), default="USD_PER_MT", nullable=False)
    currency = Column(String(5), default="USD", nullable=False)

    confirmed_laycan_start = Column(Date, nullable=False)
    confirmed_laycan_end = Column(Date, nullable=False)

    loading_terms = Column(Text, nullable=True)
    discharge_terms = Column(Text, nullable=True)
    demurrage_terms = Column(Text, nullable=True)
    despatch_terms = Column(Text, nullable=True)

    fixture_confirmation_date = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    charter_party_doc_ref = Column(String(255), nullable=True)

    fixture_status = Column(
        Enum(FixtureStatus, name="fixture_status_enum", native_enum=False),
        default=FixtureStatus.CONFIRMED,
        index=True,
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    # Relationships
    request = relationship("CharterRequest", back_populates="fixture")
    offer = relationship("BrokerOffer", back_populates="fixture")
    broker = relationship("Broker", back_populates="fixtures")
    confirmed_by_admin = relationship("User", back_populates="fixtures_confirmed")

    def __repr__(self) -> str:
        return f"<Fixture(id={self.id}, rfq={self.rfq_id}, vessel={self.confirmed_vessel_name}, status={self.fixture_status})>"


# ═══════════════════════════════════════════════════════════════════════════
# 7. REQUEST STATUS HISTORY
# ═══════════════════════════════════════════════════════════════════════════

class RequestStatusHistory(Base):
    __tablename__ = "request_status_history"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    rfq_id = Column(String(36), ForeignKey("charter_requests.id", ondelete="CASCADE"), index=True, nullable=False)
    previous_status = Column(String(40), nullable=True)
    new_status = Column(String(40), nullable=False)
    changed_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    reason_comment = Column(Text, nullable=False)
    is_user_visible = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True, nullable=False)

    # Relationships
    request = relationship("CharterRequest", back_populates="status_history")
    changed_by_user = relationship("User", back_populates="status_changes")

    def __repr__(self) -> str:
        return f"<RequestStatusHistory(id={self.id}, rfq={self.rfq_id}, {self.previous_status}->{self.new_status})>"


# ═══════════════════════════════════════════════════════════════════════════
# 8. AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════════

class AuditLog(Base):
    __tablename__ = "chartering_audit_logs"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    actor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    action = Column(String(60), index=True, nullable=False)  # e.g., BROKER_CREATED, OFFER_REVISED, FIXTURE_CONFIRMED
    entity_type = Column(String(40), index=True, nullable=False)  # broker, offer, charter_request, fixture
    entity_id = Column(String(36), index=True, nullable=False)

    change_metadata = Column(JSON, nullable=True)  # Sanitized diff or payload (NO passwords/tokens)
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True, nullable=False)

    # Relationships
    actor = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, actor={self.actor_id}, action={self.action}, entity={self.entity_type}:{self.entity_id})>"


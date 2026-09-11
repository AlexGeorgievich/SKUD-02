from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class HrEmployee(Base):
    __tablename__ = "hr_employees"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plan_employee_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    plan_name: Mapped[str] = mapped_column(String(255))
    plan_department: Mapped[str] = mapped_column(String(255))
    plan_period: Mapped[str | None] = mapped_column(String(20), nullable=True)
    in_current_plan: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    personnel_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    schedule_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    schedule_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employment_status: Mapped[str] = mapped_column(String(64), default="active", nullable=False)
    work_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    work_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_card_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_card_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_level: Mapped[str | None] = mapped_column(String(128), nullable=True)
    work_zones: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class HrPlanSync(Base):
    __tablename__ = "hr_plan_sync"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), index=True)
    plan_employee_id: Mapped[str] = mapped_column(String(120), index=True)
    plan_period: Mapped[str] = mapped_column(String(20))
    source_name: Mapped[str] = mapped_column(String(255))
    source_department: Mapped[str] = mapped_column(String(255))
    in_current_plan: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class HrImportBatch(Base):
    __tablename__ = "hr_import_batches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    author: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="preview", nullable=False)
    created_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    diagnostics: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class HrAuditLog(Base):
    __tablename__ = "hr_audit_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    author: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(64))
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[str] = mapped_column(String(120))
    changed_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

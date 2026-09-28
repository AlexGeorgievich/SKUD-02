from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
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
    family_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    given_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    patronymic: Mapped[str | None] = mapped_column(String(120), nullable=True)
    plan_department: Mapped[str] = mapped_column(String(255))
    plan_period: Mapped[str | None] = mapped_column(String(20), nullable=True)
    in_current_plan: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    office: Mapped[str | None] = mapped_column(String(255), nullable=True)
    office_id: Mapped[str | None] = mapped_column(ForeignKey("hr_offices.id"), nullable=True, index=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("hr_departments.id"), nullable=True, index=True)
    legal_entity_id: Mapped[str | None] = mapped_column(ForeignKey("hr_legal_entities.id"), nullable=True, index=True)
    gender_id: Mapped[str | None] = mapped_column(ForeignKey("hr_catalog_values.id"), nullable=True)
    work_format_id: Mapped[str | None] = mapped_column(ForeignKey("hr_catalog_values.id"), nullable=True)
    department_status: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    birth_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(nullable=True)
    birth_place: Mapped[str | None] = mapped_column(String(255), nullable=True)
    education_institution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    education_specialty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    education_graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    education_graduation_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    education_graduation_date: Mapped[date | None] = mapped_column(nullable=True)
    work_experience: Mapped[str | None] = mapped_column(String(128), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(nullable=True)
    work_schedule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department_head_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    deputy_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    deputy_from: Mapped[date | None] = mapped_column(nullable=True)
    deputy_until: Mapped[date | None] = mapped_column(nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    archived_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    personnel_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position_id: Mapped[str | None] = mapped_column(ForeignKey("hr_catalog_values.id"), nullable=True, index=True)
    position_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    schedule_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    schedule_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employment_status: Mapped[str] = mapped_column(String(64), default="active", nullable=False)
    employment_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    probation_end_date: Mapped[date | None] = mapped_column(nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsibility: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    work_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    telegram: Mapped[str | None] = mapped_column(String(255), nullable=True)
    personal_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    business_card: Mapped[str | None] = mapped_column(String(255), nullable=True)
    academic_degree: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    recruiter: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    mail_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    photo_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    insurance: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_card_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_card_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    access_level: Mapped[str | None] = mapped_column(String(128), nullable=True)
    work_zones: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class HrDepartment(Base):
    __tablename__ = "hr_departments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    office_id: Mapped[str | None] = mapped_column(ForeignKey("hr_offices.id"), nullable=True, index=True)
    head_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class HrOffice(Base):
    __tablename__ = "hr_offices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class HrLegalEntity(Base):
    __tablename__ = "hr_legal_entities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class HrCatalogValue(Base):
    __tablename__ = "hr_catalog_values"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint("kind", "label", name="uq_hr_catalog_kind_label"),)


class HrBootstrapState(Base):
    __tablename__ = "hr_bootstrap_state"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_by: Mapped[str] = mapped_column(String(120), nullable=False)
    source_period: Mapped[str] = mapped_column(String(20), nullable=False)


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

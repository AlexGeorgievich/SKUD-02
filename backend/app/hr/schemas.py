from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .validation import normalize_contact


DEPARTMENT_STATUSES = (
    "Сотрудник",
    "Руководитель отдела",
    "Заместитель руководителя",
    "Временно исполняющий обязанности",
)


class HrSafeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HrEmployeeUpdate(HrSafeModel):
    plan_name: str | None = Field(default=None, max_length=255)
    family_name: str | None = Field(default=None, max_length=120)
    given_name: str | None = Field(default=None, max_length=120)
    patronymic: str | None = Field(default=None, max_length=120)
    department: str | None = Field(default=None, max_length=255)
    office_id: str | None = Field(default=None, max_length=36)
    department_id: str | None = Field(default=None, max_length=36)
    legal_entity_id: str | None = Field(default=None, max_length=36)
    gender_id: str | None = Field(default=None, max_length=36)
    work_format_id: str | None = Field(default=None, max_length=36)
    position_id: str | None = Field(default=None, max_length=36)
    office: str | None = Field(default=None, max_length=255)
    department_status: Literal[
        "Сотрудник", "Руководитель отдела", "Заместитель руководителя", "Временно исполняющий обязанности"
    ] | None = None
    gender: Literal["Не указан", "Женский", "Мужской"] | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    birth_month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    birth_date: date | None = None
    birth_place: str | None = Field(default=None, max_length=255)
    education_institution: str | None = Field(default=None, max_length=255)
    education_specialty: str | None = Field(default=None, max_length=255)
    education_graduation_year: int | None = Field(default=None, ge=1900, le=2100)
    education_graduation_month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    education_graduation_date: date | None = None
    work_experience: str | None = Field(default=None, max_length=128)
    hire_date: date | None = None
    work_schedule: str | None = Field(default=None, max_length=255)
    department_head_id: str | None = Field(default=None, max_length=36)
    deputy_id: str | None = Field(default=None, max_length=36)
    deputy_from: date | None = None
    deputy_until: date | None = None
    personnel_number: str | None = Field(default=None, max_length=64)
    position: str | None = Field(default=None, max_length=255)
    position_en: str | None = Field(default=None, max_length=255)
    schedule_type: str | None = Field(default=None, max_length=64)
    schedule_hours: int | None = Field(default=None, ge=0, le=168)
    employment_status: str | None = Field(default=None, max_length=64)
    employment_type: Literal["permanent", "probation"] | None = None
    probation_end_date: date | None = None
    comments: str | None = None
    responsibility: str | None = None
    work_email: str | None = Field(default=None, max_length=255)
    work_phone: str | None = Field(default=None, max_length=64)
    telegram: str | None = Field(default=None, max_length=255)
    personal_phone: str | None = Field(default=None, max_length=64)
    business_card: str | None = Field(default=None, max_length=255)
    academic_degree: str | None = Field(default=None, max_length=255)
    recommendation: str | None = None
    recruiter: str | None = Field(default=None, max_length=255)
    photo_source_url: str | None = Field(default=None, max_length=1024)
    mail_image_url: str | None = Field(default=None, max_length=1024)
    insurance: str | None = Field(default=None, max_length=255)
    access_card_number: str | None = Field(default=None, max_length=64)
    access_card_status: str | None = Field(default=None, max_length=64)
    access_level: str | None = Field(default=None, max_length=128)
    work_zones: list[str] | None = None

    @field_validator("work_email")
    @classmethod
    def valid_email(cls, value: str | None) -> str | None:
        return normalize_contact("email", value)

    @field_validator("work_phone", "personal_phone")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        return normalize_contact("phone", value)

    @field_validator("telegram")
    @classmethod
    def valid_telegram(cls, value: str | None) -> str | None:
        return normalize_contact("telegram", value)


class HrEmployeeCreate(HrEmployeeUpdate):
    @model_validator(mode="after")
    def required_identity(self):
        structured = bool(self.family_name and self.given_name and self.department_id)
        legacy = bool(self.plan_name and self.department)
        if not structured and not legacy:
            raise ValueError("Укажите фамилию, имя и отдел из справочника")
        return self


class HrDepartmentCreate(HrSafeModel):
    name: str = Field(min_length=1, max_length=255)
    head_id: str | None = Field(default=None, max_length=36)


class HrImportRows(HrSafeModel):
    rows: list[dict] = Field(default_factory=list, max_length=3000)


class HrXlsxApply(HrSafeModel):
    batch_id: str = Field(min_length=1, max_length=36)
    confirm_archive_ids: list[str] = Field(default_factory=list, max_length=5000)

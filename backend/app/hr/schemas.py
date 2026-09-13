from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
    department: str | None = Field(default=None, max_length=255)
    office: str | None = Field(default=None, max_length=255)
    department_status: Literal[
        "Сотрудник", "Руководитель отдела", "Заместитель руководителя", "Временно исполняющий обязанности"
    ] | None = None
    gender: Literal["Не указан", "Женский", "Мужской"] | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    birth_month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    birth_date: date | None = None
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
    schedule_type: str | None = Field(default=None, max_length=64)
    schedule_hours: int | None = Field(default=None, ge=0, le=168)
    employment_status: str | None = Field(default=None, max_length=64)
    employment_type: Literal["permanent", "probation"] | None = None
    probation_end_date: date | None = None
    comments: str | None = None
    responsibility: str | None = None
    work_email: str | None = Field(default=None, max_length=255)
    work_phone: str | None = Field(default=None, max_length=64)
    access_card_number: str | None = Field(default=None, max_length=64)
    access_card_status: str | None = Field(default=None, max_length=64)
    access_level: str | None = Field(default=None, max_length=128)
    work_zones: list[str] | None = None


class HrEmployeeCreate(HrEmployeeUpdate):
    plan_name: str = Field(min_length=1, max_length=255)
    department: str = Field(min_length=1, max_length=255)


class HrDepartmentCreate(HrSafeModel):
    name: str = Field(min_length=1, max_length=255)
    head_id: str | None = Field(default=None, max_length=36)


class HrImportRows(HrSafeModel):
    rows: list[dict] = Field(default_factory=list, max_length=3000)

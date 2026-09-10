from pydantic import BaseModel, Field


class HrEmployeeUpdate(BaseModel):
    personnel_number: str | None = Field(default=None, max_length=64)
    position: str | None = Field(default=None, max_length=255)
    schedule_type: str | None = Field(default=None, max_length=64)
    schedule_hours: int | None = Field(default=None, ge=0, le=168)
    employment_status: str | None = Field(default=None, max_length=64)
    work_email: str | None = Field(default=None, max_length=255)
    work_phone: str | None = Field(default=None, max_length=64)
    access_card_number: str | None = Field(default=None, max_length=64)
    access_card_status: str | None = Field(default=None, max_length=64)
    access_level: str | None = Field(default=None, max_length=128)
    work_zones: list[str] | None = None


class HrImportRows(BaseModel):
    rows: list[dict] = Field(default_factory=list, max_length=3000)

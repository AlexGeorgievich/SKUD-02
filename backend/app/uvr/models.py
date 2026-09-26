from datetime import datetime
from uuid import uuid4
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from ..hr.models import Base,utcnow

class UvrPeriod(Base):
 __tablename__='uvr_periods'
 period:Mapped[str]=mapped_column(String(7),primary_key=True)
 closed:Mapped[bool]=mapped_column(Boolean,default=False,nullable=False)
 closed_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True),nullable=True)
 closed_by:Mapped[str|None]=mapped_column(String(120),nullable=True)
 created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,nullable=False)

class UvrSourceVersion(Base):
 __tablename__='uvr_source_versions'
 id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
 period:Mapped[str]=mapped_column(ForeignKey('uvr_periods.period'),index=True)
 kind:Mapped[str]=mapped_column(String(16),index=True)
 version:Mapped[int]=mapped_column(Integer)
 content_hash:Mapped[str]=mapped_column(String(64))
 blob:Mapped[bytes]=mapped_column(LargeBinary)
 author:Mapped[str]=mapped_column(String(120))
 reason:Mapped[str|None]=mapped_column(Text,nullable=True)
 created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,nullable=False)
 __table_args__=(UniqueConstraint('period','kind','version'),UniqueConstraint('period','kind','content_hash'))

class UvrSourceRow(Base):
 __tablename__='uvr_source_rows'
 id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
 source_version_id:Mapped[str]=mapped_column(ForeignKey('uvr_source_versions.id'),index=True)
 row_number:Mapped[int]=mapped_column(Integer)
 employee_id:Mapped[str]=mapped_column(String(36),index=True)
 source_name:Mapped[str]=mapped_column(String(255))
 source_department:Mapped[str|None]=mapped_column(String(255),nullable=True)
 values:Mapped[list|dict|None]=mapped_column(JSON,nullable=True)

class UvrCalculationVersion(Base):
 __tablename__='uvr_calculation_versions'
 id:Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
 period:Mapped[str]=mapped_column(ForeignKey('uvr_periods.period'),index=True)
 version:Mapped[int]=mapped_column(Integer)
 source_versions:Mapped[dict]=mapped_column(JSON)
 result:Mapped[dict]=mapped_column(JSON)
 author:Mapped[str]=mapped_column(String(120))
 created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,nullable=False)

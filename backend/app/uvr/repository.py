from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from .models import UvrPeriod,UvrSourceRow,UvrSourceVersion
from ..hr.models import utcnow

class UvrRepository:
 def __init__(self,engine_or_url):
  if isinstance(engine_or_url,str):
   kwargs={'connect_args':{'check_same_thread':False},'poolclass':StaticPool} if ':memory:' in engine_or_url else {}
   self.engine=create_engine(engine_or_url,**kwargs)
  else:self.engine=engine_or_url
  self.sessions=sessionmaker(self.engine,expire_on_commit=False)
 def periods(self):
  with self.sessions() as s:return list(s.scalars(select(UvrPeriod).order_by(UvrPeriod.period.desc())))
 def period(self,period):
  with self.sessions() as s:return s.get(UvrPeriod,period)
 def versions(self,period,kind):
  with self.sessions() as s:
   versions=list(s.scalars(select(UvrSourceVersion).where(UvrSourceVersion.period==period,UvrSourceVersion.kind==kind).order_by(UvrSourceVersion.version)))
   return [(v,list(s.scalars(select(UvrSourceRow).where(UvrSourceRow.source_version_id==v.id).order_by(UvrSourceRow.row_number)))) for v in versions]
 def publish(self,period,kind,content_hash,blob,rows,mapping,author,reason):
  with self.sessions.begin() as s:
   existing=s.scalar(select(UvrSourceVersion).where(UvrSourceVersion.period==period,UvrSourceVersion.kind==kind,UvrSourceVersion.content_hash==content_hash))
   if existing:return existing,False
   month=s.get(UvrPeriod,period)
   if month is None:month=UvrPeriod(period=period);s.add(month);s.flush()
   if month.closed and not reason:raise ValueError('Закрытый месяц можно исправить только с указанием причины')
   number=(s.scalar(select(func.max(UvrSourceVersion.version)).where(UvrSourceVersion.period==period,UvrSourceVersion.kind==kind)) or 0)+1
   version=UvrSourceVersion(period=period,kind=kind,version=number,content_hash=content_hash,blob=blob,author=author,reason=reason);s.add(version);s.flush()
   for index,row in enumerate(rows,1):
    row_number=int(row.get('row_number') or index)
    s.add(UvrSourceRow(source_version_id=version.id,row_number=row_number,employee_id=mapping[row_number],source_name=row.get('name',''),source_department=row.get('department') or None,values=row.get('values')))
   return version,True
 def close(self,period,author):
  with self.sessions.begin() as s:
   month=s.get(UvrPeriod,period)
   if month is None:month=UvrPeriod(period=period);s.add(month)
   month.closed=True;month.closed_at=utcnow();month.closed_by=author

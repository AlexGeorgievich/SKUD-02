import json
from datetime import date
from fastapi import APIRouter,Depends,File,Form,UploadFile
from ...container import Container
from ...domain.errors import ServiceError
from ...hr.matching import preview_source,resolve_source
from ...infrastructure.excel.reader import read_input
from ...infrastructure.excel.control_reader import read_control_xlsx
from ...uvr.control_analytics import control_summary
from .hr import can_view
from ..dependencies import current_user,get_container

router=APIRouter(prefix='/api/uvr',tags=['uvr'])

def service(c):
 if c.uvr is None or c.hr is None:raise ServiceError('История УВР требует подключения базы данных',503)
 return c.uvr

@router.get('/periods')
def periods(user:dict=Depends(current_user),c:Container=Depends(get_container)):return service(c).periods()

@router.get('/periods/{period}')
def period(period:str,user:dict=Depends(current_user),c:Container=Depends(get_container)):
 try:return service(c).period(period)
 except KeyError:raise ServiceError('Месяц не найден',404)

def rows_for(blob,kind,period):
 if kind in ('plan','fact'):return read_input(blob,kind,period)
 if kind=='control':
  rows=read_control_xlsx(blob,period)
  for row in rows:row['values']={key:value for key,value in row.items() if key not in ('row_number','name','department','errors')}
  return rows
 raise ServiceError('Источник не поддерживается',400)

@router.post('/periods/{period}/sources/{kind}/preview')
async def source_preview(period:str,kind:str,file:UploadFile=File(...),user:dict=Depends(current_user),c:Container=Depends(get_container)):
 if user['role'] not in ('admin','timekeeper'):raise ServiceError('Нет права на загрузку источника',403)
 blob=await file.read(c.settings.upload_limit+1);rows=rows_for(blob,kind,period)
 roster=c.hr.repository.list_employees();preview=preview_source(rows,kind,roster)
 errors=[{'row':row['row_number'],**error} for row in rows for error in row.get('errors',[])]
 names={employee.id:{'id':employee.id,'name':employee.plan_name,'department':employee.department} for employee in roster}
 all_candidates=list(names.values())
 return {'rows':[{**item.__dict__,'candidates':all_candidates if item.status=='unknown' else [names[identifier] for identifier in item.candidate_ids if identifier in names]} for item in preview],'requires_review':sum(item.status!='matched' for item in preview)+len(errors),'errors':errors}

@router.post('/periods/{period}/sources/{kind}/apply')
async def source_apply(period:str,kind:str,file:UploadFile=File(...),decisions:str=Form('{}'),reason:str|None=Form(None),user:dict=Depends(current_user),c:Container=Depends(get_container)):
 if user['role'] not in ('admin','timekeeper'):raise ServiceError('Нет права на загрузку источника',403)
 blob=await file.read(c.settings.upload_limit+1);rows=rows_for(blob,kind,period);preview=preview_source(rows,kind,c.hr.repository.list_employees())
 errors=[error for row in rows for error in row.get('errors',[])]
 if errors:raise ServiceError('Источник содержит ошибки; исправьте их до применения',400)
 try:mapping=resolve_source(preview,{int(key):value for key,value in json.loads(decisions).items()})
 except (ValueError,json.JSONDecodeError) as error:raise ServiceError(str(error),400)
 valid={item.id for item in c.hr.repository.list_employees()}
 if not set(mapping.values())<=valid:raise ServiceError('Решение содержит неизвестный UUID КУС',400)
 try:return service(c).publish(period,kind,blob,rows,mapping,user['username'],reason)
 except ValueError as error:raise ServiceError(str(error),409)

@router.post('/periods/{period}/close')
def close(period:str,user:dict=Depends(current_user),c:Container=Depends(get_container)):
 if user['role'] not in ('admin','timekeeper'):raise ServiceError('Нет права на закрытие месяца',403)
 return service(c).close(period,user['username'])

@router.post('/periods/{period}/calculate')
def calculate(period:str,asof:date|None=None,user:dict=Depends(current_user),c:Container=Depends(get_container)):
 if user['role'] not in ('admin','timekeeper'):raise ServiceError('Нет права на расчёт УВР',403)
 try:return service(c).calculate(period,user['username'],asof=asof)
 except ValueError as error:raise ServiceError(str(error),409)

@router.get('/periods/{period}/calculation')
def calculation(period:str,user:dict=Depends(current_user),c:Container=Depends(get_container)):
 item=service(c).repository.latest_calculation(period)
 if item is None:raise ServiceError('Расчёт за месяц ещё не сформирован',404)
 allowed={employee.id for employee in c.hr.repository.list_employees() if can_view(user,employee,c.auth.repository.key())}
 result={**item.result,'employees':[row for row in item.result['employees'] if row['employee_id'] in allowed],'days':[row for row in item.result['days'] if row['employee_id'] in allowed],'unmatched':[row for row in item.result['unmatched'] if row['employee_id'] in allowed]}
 return {'id':item.id,'period':period,'version':item.version,'source_versions':item.source_versions,'result':result,'author':item.author}

@router.get('/periods/{period}/control-summary')
def source_control_summary(period:str,user:dict=Depends(current_user),c:Container=Depends(get_container)):
 data=service(c).period(period);versions=data['sources']['control']
 if not versions:return {'version':None,**control_summary([],set())}
 employees=c.hr.repository.list_employees();allowed={item.id for item in employees if can_view(user,item,c.auth.repository.key())}
 latest=versions[-1];rows=[{'employee_id':row['employee_id'],**(row.get('values') or {})} for row in latest['rows']]
 return {'version':latest['version'],**control_summary(rows,allowed)}

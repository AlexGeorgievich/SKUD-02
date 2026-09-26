from hashlib import sha256
from collections import Counter,defaultdict
from datetime import date
from ..domain.attendance import parse_event
from ..domain.calendar import month_dates
from ..domain.constants import CODES

class UvrService:
 def __init__(self,repository):self.repository=repository
 def publish(self,period,kind,blob,rows,mapping,author,reason=None):
  if kind not in ('plan','fact','control'):raise ValueError('Неизвестный тип источника')
  version,created=self.repository.publish(period,kind,sha256(blob).hexdigest(),blob,rows,mapping,author,reason)
  return {'id':version.id,'version':version.version,'status':'published' if created else 'unchanged'}
 def close(self,period,author):self.repository.close(period,author);return {'period':period,'closed':True}
 def periods(self):return [{'period':p.period,'closed':p.closed} for p in self.repository.periods()]
 def period(self,period):
  month=self.repository.period(period)
  if month is None:raise KeyError(period)
  sources={}
  for kind in ('plan','fact','control'):
   sources[kind]=[{'id':v.id,'version':v.version,'author':v.author,'reason':v.reason,'rows':[{'row_number':r.row_number,'employee_id':r.employee_id,'source_name':r.source_name,'source_department':r.source_department,'values':r.values} for r in rows]} for v,rows in self.repository.versions(period,kind)]
  return {'period':period,'closed':month.closed,'sources':sources}
 def calculate(self,period,author,asof=None):
  sources=self.repository.latest_sources(period)
  if 'plan' not in sources or 'fact' not in sources:raise ValueError('Для расчёта нужны применённые План и СКУД')
  plan_version,plan_rows=sources['plan'];fact_version,fact_rows=sources['fact']
  plan_by_id=defaultdict(list);fact_by_id=defaultdict(list);control_by_id=defaultdict(list)
  for row in plan_rows:plan_by_id[row.employee_id].append(row)
  for row in fact_rows:fact_by_id[row.employee_id].append(row)
  if 'control' in sources:
   for row in sources['control'][1]:control_by_id[row.employee_id].append(row)
  duplicates=[identifier for identifier,rows in plan_by_id.items() if len(rows)>1]
  duplicates += [identifier for identifier,rows in fact_by_id.items() if len(rows)>1]
  duplicates += [identifier for identifier,rows in control_by_id.items() if len(rows)>1]
  if duplicates:raise ValueError('В источниках есть повторные строки, сопоставленные одной карточке КУС')
  dates=month_dates(period);asof=date.fromisoformat(asof) if isinstance(asof,str) else (asof or date.today())
  fact_by_id={key:value[0] for key,value in fact_by_id.items()}
  employees=[];days=[]
  for employee_id,rows in plan_by_id.items():
   row=rows[0];fact=fact_by_id.get(employee_id);own=[]
   for index,day in enumerate(dates):
    rawcode=str((row.values or [])[index] or '').strip() if index<len(row.values or []) else ''
    code={item.casefold():item for item in CODES}.get(rawcode.casefold(),rawcode)
    raw=(fact.values or [])[index] if fact and index<len(fact.values or []) else None
    event=parse_event(raw);issues=[]
    if code not in CODES:issues.append('Неизвестный или пустой код плана')
    if not fact:issues.append('Сотрудник отсутствует в СКУД')
    if event['issue']:issues.append(event['issue'])
    if day<=asof:
     if code=='О' and not event['registered']:issues.append('План О: нет регистрации (требует уточнения)')
     if code in ('Отп','Б','От','Вых') and event['registered']:issues.append('Регистрация вне планового присутствия')
    elif event['registered']:issues.append('Регистрация в будущую дату')
    message='; '.join(issues) or ('Будущий день' if day>asof else ('Удалёнка: СКУД не подтверждает работу' if code=='Д' else 'Без замечаний'))
    item={'employee_id':employee_id,'employee_name':row.source_name,'department':row.source_department or '', 'date':day.isoformat(),'plan':code,'raw':str(raw or ''),'result':message,'problem':bool(issues),**event}
    own.append(item);days.append(item)
   counts=Counter(item['plan'] for item in own)
   control_values=control_by_id.get(employee_id,[None])[0]
   control_data={key:(control_values.values or {}).get(key) for key in ('active_hours','useful_hours','hh_minutes')} if control_values else None
   employees.append({'employee_id':employee_id,'employee_name':row.source_name,'department':row.source_department or '', 'counts':dict(counts),'minutes':sum(item['minutes'] or 0 for item in own),'registered_days':sum(item['registered'] for item in own),'issues':sum(item['problem'] for item in own),'control':control_data})
  unmatched=[{'employee_id':identifier,'reason':'Сотрудник из СКУД отсутствует в плане'} for identifier in fact_by_id if identifier not in plan_by_id]
  source_versions={kind:{'id':version.id,'version':version.version} for kind,(version,_) in sources.items()}
  result={'period':period,'asof':asof.isoformat(),'source_versions':{kind:item['version'] for kind,item in source_versions.items()},'employees':employees,'days':days,'unmatched':unmatched}
  saved=self.repository.save_calculation(period,source_versions,result,author)
  return {'id':saved.id,'version':saved.version,**result}

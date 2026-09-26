from hashlib import sha256

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

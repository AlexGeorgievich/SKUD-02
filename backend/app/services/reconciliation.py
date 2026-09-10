from collections import Counter
from datetime import date
from ..domain.constants import CODES
from ..domain.calendar import month_dates
from ..domain.identity import token
from ..domain.attendance import parse_event
from ..infrastructure.excel.reader import read_input

def process(p,f,period,key,asof=None):
    plan=read_input(p,'plan',period);fact=read_input(f,'fact',period);dates=month_dates(period)
    asof=asof or date.today();byfact={token(r['name'],key):r for r in fact}
    mapping={token(r['name'],key):r['name'] for r in plan};days=[];employees=[]
    for r in plan:
        ident=token(r['name'],key);fr=byfact.get(ident);own=[]
        for i,d in enumerate(dates):
            rawcode=str(r['values'][i] or '').strip();code={x.casefold():x for x in CODES}.get(rawcode.casefold(),rawcode)
            raw=fr['values'][i] if fr else None;event=parse_event(raw);issues=[]
            if code not in CODES:issues.append('Неизвестный или пустой код плана')
            if not fr:issues.append('Сотрудник отсутствует в СКУД')
            if event['issue']:issues.append(event['issue'])
            if d<=asof:
                if code=='О' and not event['registered']:issues.append('План О: нет регистрации (требует уточнения)')
                if code in ('Отп','Б','От','Вых') and event['registered']:issues.append('Регистрация вне планового присутствия')
            elif event['registered']:issues.append('Регистрация в будущую дату')
            result='; '.join(issues) or ('Будущий день' if d>asof else ('Удалёнка: СКУД не подтверждает работу' if code=='Д' else 'Без замечаний'))
            item=dict(id=ident,department=r['department'],date=d.isoformat(),plan=code,raw=str(raw or ''),result=result,problem=bool(issues),**event)
            own.append(item);days.append(item)
        counts=Counter(x['plan'] for x in own)
        e=dict(id=ident,department=r['department'],counts=dict(counts),minutes=sum(x['minutes'] or 0 for x in own),registered=sum(x['registered'] for x in own),issues=sum(x['problem'] for x in own),office_elapsed=sum(x['plan']=='О' and x['date']<=asof.isoformat() for x in own),office_confirmed=sum(x['plan']=='О' and x['registered'] and x['date']<=asof.isoformat() for x in own))
        employees.append(e)
    unmatched=[dict(id=t,reason='ФИ из СКУД отсутствует в плане') for t in byfact if t not in mapping]
    return dict(period=period,asof=asof.isoformat(),employees=employees,days=days,unmatched=unmatched),mapping


import re

def parse_event(raw):
    if raw is None or str(raw).strip() in ('','—','-'):return {'arrival':'','departure':'','minutes':None,'issue':'','registered':False}
    s=str(raw).strip();parts=s.split('--')
    times=re.findall(r'(?<!\d)(\d{1,2}):(\d{2})(?!\d)',parts[0])
    if not times or len(times)>2 or any(int(h)>23 or int(m)>59 for h,m in times):
        return dict(arrival='',departure='',minutes=None,issue='Некорректная ячейка СКУД',registered=bool(times))
    a=':'.join(times[0]);b=':'.join(times[1]) if len(times)==2 else ''
    if not b:return dict(arrival=a,departure='',minutes=None,issue='Неполные данные',registered=True)
    start=int(times[0][0])*60+int(times[0][1]);end=int(times[1][0])*60+int(times[1][1])
    if end<start:return dict(arrival=a,departure=b,minutes=None,issue='Переход суток: требуется уточнение',registered=True)
    minutes=end-start;issue=''
    if len(parts)!=2 or not re.fullmatch(r'\s*\d+:\d{2}\s*',parts[1]):issue='Не указан корректный итог дня'
    else:
        h,m=map(int,parts[1].strip().split(':'))
        if m>59 or h*60+m!=minutes:issue='Итог дня не совпадает с приходом/уходом'
    return dict(arrival=a,departure=b,minutes=minutes,issue=issue,registered=True)


import calendar
import re
from datetime import date

def month_dates(period):
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])',period):
        raise ValueError('Период должен иметь формат ГГГГ-ММ (2000–2099)')
    y,m=map(int,period.split('-'))
    return [date(y,m,d) for d in range(1,calendar.monthrange(y,m)[1]+1)]


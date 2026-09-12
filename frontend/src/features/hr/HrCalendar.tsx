import {useEffect, useMemo, useState} from 'react';
import {api, errorText} from '../../shared/api/client';

type CalendarEvent={employee_id:string;employee_name:string;department:string;date:string;kind:'hire_anniversary'};
type Employee={id:string;hire_date?:string|null;birth_year?:number|null};

function monthNow(){return new Date().toISOString().slice(0,7)}
function displayDate(value:string){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`))}

export function HrCalendar({employees,notify,onOpen}:{employees:Employee[];notify:(message:string)=>void;onOpen:(id:string)=>void}){
 const [month,setMonth]=useState(monthNow()),[events,setEvents]=useState<CalendarEvent[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{setLoading(true);api<{items:CalendarEvent[]}>(`/api/hr/calendar?month=${month}`).then(result=>setEvents(result.items)).catch(error=>notify(errorText(error))).finally(()=>setLoading(false))},[month]);
 const hires=useMemo(()=>new Map(employees.map(employee=>[employee.id,employee.hire_date])),[employees]);
 const withBirthYear=employees.filter(employee=>employee.birth_year).length;
 return <section className="hr-calendar-view">
  <div className="hr-content-head"><div><p className="eyebrow">КАЛЕНДАРЬ КОРПОРАТИВНЫХ СОБЫТИЙ</p><h2>Дни рождения и годовщины работы</h2><p>Календарь строится только по заполненным кадровым данным — даты не предполагаются автоматически.</p></div><label className="hr-month-control"><span>Месяц</span><input aria-label="Месяц календаря" type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label></div>
  <div className="hr-kpi-row"><article><span>Событий в периоде</span><b>{events.length}</b><small>подтверждённые даты</small></article><article><span>Годовщины работы</span><b>{events.length}</b><small>по дате приёма</small></article><article><span>Указан год рождения</span><b>{withBirthYear}</b><small>без выдумывания дня рождения</small></article><article><span>Всего в штате</span><b>{employees.length}</b><small>действующие карточки</small></article></div>
  <section className="card hr-event-panel"><div className="hr-event-toolbar"><h3>События месяца</h3><span>{month}</span></div>{loading?<p role="status">Загружаем календарь…</p>:events.length?<div className="hr-event-grid">{events.map(event=>{const hire=hires.get(event.employee_id);const years=hire?Number(month.slice(0,4))-Number(hire.slice(0,4)):null;return <article key={`${event.employee_id}-${event.date}`} className="hr-event-card"><div><span className="hr-event-kind">Годовщина работы</span><b>{displayDate(event.date)}</b></div><h3>{event.employee_name}</h3><p>{event.department}</p><strong>{years&&years>0?`${years} ${years===1?'год':'лет'} в компании`:'Дата приёма подтверждена'}</strong><button onClick={()=>onOpen(event.employee_id)}>Карточка сотрудника →</button></article>})}</div>:<div className="hr-empty-state"><b>На выбранный месяц событий нет</b><span>Заполните дату приёма в карточках сотрудников.</span></div>}</section>
 </section>
}

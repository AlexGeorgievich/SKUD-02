import {useEffect,useMemo,useState,type CSSProperties,type ReactNode} from 'react';
import {DataTable} from '../../shared/ui';
import {summarize} from './model';
import {CODES,STATUS_COLORS,STATUS_LABELS,type Day,type Employee} from '../../shared/types';
function pluralPeople(count:number){return `${count} ${count===1?'сотрудник':count<5?'сотрудника':'сотрудников'}`}
function Collapsible({title,open,onToggle,children}:{title:string;open:boolean;onToggle:()=>void;children:ReactNode}){return <section className="collapsible-panel"><button className="collapse-head" aria-expanded={open} onClick={onToggle}><span role="heading" aria-level={3}>{title}</span><span className="collapse-chevron" aria-hidden="true">{open?'⌄':'>'}</span></button>{open&&children}</section>}
export function Dashboard({employees,days,unmatched,onDepartment}:{employees:Employee[];days:Day[];unmatched:number;onDepartment:(department:string)=>void}){
 const s=summarize(employees),deps=[...new Set(employees.map(e=>e.department))];
 const groups=deps.map(department=>({department,...summarize(employees.filter(e=>e.department===department))}));
 const availableDates=useMemo(()=>[...new Set(days.map(day=>day.date))].sort(),[days]);
 const [selectedDate,setSelectedDate]=useState(availableDates[0]||'');
 const [status,setStatus]=useState('');
 const [dailyDepartment,setDailyDepartment]=useState<string|null>(null),[dailyEmployee,setDailyEmployee]=useState<string|null>(null);
 const [openPanels,setOpenPanels]=useState<Record<string,boolean>>({});
 const togglePanel=(key:string)=>setOpenPanels(current=>({...current,[key]:!current[key]}));
 const dateRows=useMemo(()=>days.filter(day=>day.date===selectedDate),[days,selectedDate]);
 const statusTotals=useMemo(()=>Object.fromEntries(CODES.map(code=>[code,dateRows.filter(day=>day.plan===code).length])),[dateRows]);
 const departmentRows=deps.map(department=>{const rows=dateRows.filter(day=>day.department===department);return {department,counts:Object.fromEntries(CODES.map(code=>[code,rows.filter(day=>day.plan===code).length])),total:rows.length}});
 const selectedRows=dateRows.filter(day=>!status||day.plan===status);
 const scopedRows=selectedRows.filter(day=>!dailyDepartment||day.department===dailyDepartment);
 const selectedDepartmentRows=dailyDepartment?selectedRows.filter(day=>day.department===dailyDepartment):[];
 const selectedDepartmentTotals=Object.fromEntries(CODES.map(code=>[code,selectedDepartmentRows.filter(day=>day.plan===code).length]));
 const selectedEmployee=employees.find(employee=>employee.id===dailyEmployee);
 useEffect(()=>{function onEscape(event:KeyboardEvent){if(event.key!=='Escape')return;if(dailyEmployee){event.preventDefault();setDailyEmployee(null)}else if(dailyDepartment){event.preventDefault();setDailyDepartment(null)}}document.addEventListener('keydown',onEscape);return()=>document.removeEventListener('keydown',onEscape)},[dailyDepartment,dailyEmployee]);
 return <><div className="kpis">{[
 ['Сотрудников в выборке',s.people,'По ключевой таблице плана'],
 ['Подтверждение офисных дней',s.ratio===null?'—':s.ratio+'%',`${s.confirmed} из ${s.office} прошедших офисных дней`],
 ['Часы присутствия СКУД',(s.minutes/60).toFixed(1),'Без вычета перерывов; не оценка продуктивности'],
 ['Дни с замечаниями',s.issues,`Вне плана: ${unmatched} записей СКУД (всего в наборе)`]
 ].map(([a,b,c])=><div className="card" key={a}><p>{a}</p><b>{b}</b><small>{c}</small></div>)}</div>
 <div className="card daily-analytics" data-testid="daily-analytics"><div className="daily-analytics-head"><div><h2>Сводка по дате</h2><p>Плановые статусы всех отделов на выбранное число.</p></div><div className="daily-filters"><label>Дата аналитики<input aria-label="Дата аналитики" type="date" min={availableDates[0]} max={availableDates.at(-1)} value={selectedDate} onChange={event=>{setSelectedDate(event.target.value);setDailyDepartment(null);setDailyEmployee(null)}}/></label><label>Статус плана<select aria-label="Статус плана" value={status} onChange={event=>{setStatus(event.target.value);setDailyDepartment(null);setDailyEmployee(null)}}><option value="">Все статусы</option>{CODES.map(code=><option key={code} value={code}>{code} — {STATUS_LABELS[code]}</option>)}</select></label></div></div>
 <h3>Итого по офису</h3><div className="daily-status-grid">{CODES.map(code=><div className={`daily-status-card${status===code?' selected':''}`} key={code} style={{'--status-color':STATUS_COLORS[code]} as CSSProperties}><span>{code} — {STATUS_LABELS[code]}</span><b>{statusTotals[code]||0}</b><small>{pluralPeople(statusTotals[code]||0)}</small></div>)}</div>
 {dailyDepartment&&<section className="daily-department-summary" aria-label={`Сводка отдела ${dailyDepartment}`}><h3>Итого по отделу: {dailyDepartment}</h3><div className="daily-status-grid">{CODES.map(code=><div className={`daily-status-card${status===code?' selected':''}`} key={code} style={{'--status-color':STATUS_COLORS[code]} as CSSProperties}><span>{code} — {STATUS_LABELS[code]}</span><b>{selectedDepartmentTotals[code]||0}</b><small>{pluralPeople(selectedDepartmentTotals[code]||0)}</small></div>)}</div></section>}
 {!dailyDepartment&&!dailyEmployee&&<Collapsible title="Все отделы" open={!!openPanels.departments} onToggle={()=>togglePanel('departments')}><DataTable headers={['Отдел',...CODES,'Всего']} rows={departmentRows.filter(row=>!status||row.counts[status]>0).map(row=>({key:row.department,cells:[<button className="department-link" onClick={()=>{setDailyDepartment(row.department);setOpenPanels(current=>({...current,employees:true}))}}>{row.department}</button>,...CODES.map(code=>row.counts[code]),row.total]}))}/></Collapsible>}
 {dailyDepartment&&!dailyEmployee&&<Collapsible title={`Отдел: ${dailyDepartment}`} open={openPanels.employees!==false} onToggle={()=>togglePanel('employees')}><DataTable headers={['Сотрудник','Статус','Факт СКУД']} rows={scopedRows.map(day=>({key:day.id+day.date,cells:[<button className="department-link" onClick={()=>{setDailyEmployee(day.id);setOpenPanels(current=>({...current,employeeDetail:true}))}}>{employees.find(employee=>employee.id===day.id)?.name||day.id}</button>,<span className="daily-status-badge" style={{background:STATUS_COLORS[day.plan]}}>{day.plan}</span>,<span className="daily-fact">{day.raw||'—'}</span>]}))} compact/></Collapsible>}
 {dailyEmployee&&selectedEmployee&&<Collapsible title={`Сотрудник: ${selectedEmployee.name}`} open={openPanels.employeeDetail!==false} onToggle={()=>togglePanel('employeeDetail')}><DataTable headers={['Дата','Отдел','Статус','Факт СКУД','Результат']} rows={scopedRows.filter(day=>day.id===dailyEmployee).map(day=>({key:day.id+day.date,cells:[day.date,day.department,<span className="daily-status-badge" style={{background:STATUS_COLORS[day.plan]}}>{day.plan}</span>,<span className="daily-fact">{day.raw||'—'}</span>,day.result]}))} compact/></Collapsible>}
 </div>
 <div className="card"><Collapsible title="Подтверждение офисных дней по отделам" open={openPanels.confirmation!==false} onToggle={()=>togglePanel('confirmation')}><p>Прошедшие дни «О» с хотя бы одной регистрацией / прошедшие дни «О». Неполные регистрации требуют проверки.</p><div className="bars">{groups.map(g=><div className="barrow" key={g.department}><button className="department-link" onClick={()=>onDepartment(g.department)}>{g.department}</button><progress aria-label={g.department} value={g.ratio??0} max={100}/><b>{g.ratio===null?'—':g.ratio+'%'}</b></div>)}</div></Collapsible></div>
 <div className="card"><Collapsible title="Сравнение отделов" open={!!openPanels.comparison} onToggle={()=>togglePanel('comparison')}><DataTable headers={['Отдел','Штат','Прошедшие дни О','Регистрации, дней','Часы СКУД','Замечания']} rows={groups.map(g=>({key:g.department,cells:[<button className="department-link" onClick={()=>onDepartment(g.department)}>{g.department}</button>,g.people,g.office,g.registered,(g.minutes/60).toFixed(1),g.issues]}))}/></Collapsible></div></>
}

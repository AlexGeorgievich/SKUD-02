import type {ReactNode} from 'react';
import type {GridRow} from '../../shared/ui';
import {CODES,STATUS_COLORS,STATUS_LABELS,type Dataset,type Employee,type View} from '../../shared/types';
import {PagedTable} from '../../shared/ui/PagedTable';
export function Records({view,data,employees,printing,onPerson}:{view:View;data:Dataset;employees:Employee[];printing:boolean;onPerson:(id:string)=>void}){
 const people=new Map(employees.map(e=>[e.id,e]));const days=data.days.filter(d=>people.has(d.id));
 const byEmployee=new Map<string,typeof days>();for(const d of days){const list=byEmployee.get(d.id)||[];list.push(d);byEmployee.set(d.id,list)}
 let headers:ReactNode[],rows:GridRow[],columnClasses:string[]|undefined;
 const primary=['План','Факт','План-факт'].includes(view);
 const calendarMeta=(count:number,fixed:number)=>{
  const weekdays=['вс','пн','вт','ср','чт','пт','сб'];
  const dayHeaders=Array.from({length:count},(_,index)=>{const day=index+1,date=new Date(Number(data.period.slice(0,4)),Number(data.period.slice(5,7))-1,day);return <span className="calendar-head"><b>{day}</b><small>{weekdays[date.getDay()]}</small></span>});
  const dayClasses=Array.from({length:count},(_,index)=>{const day=index+1,date=new Date(Number(data.period.slice(0,4)),Number(data.period.slice(5,7))-1,day),weekend=date.getDay()===0||date.getDay()===6;const holiday=employees.length>0&&employees.every(employee=>(byEmployee.get(employee.id)||[]).find(item=>Number(item.date.slice(8,10))===day)?.plan==='Вых');return `calendar-day${weekend||holiday?' calendar-nonworking':''}${weekend?' calendar-weekend':''}${holiday&&!weekend?' calendar-holiday':''}`});
  return {dayHeaders,columnClasses:[...Array.from({length:fixed},(_,index)=>index<2?'calendar-frozen':''),...dayClasses]};
 };
 if(view==='План-факт'){
  const n=new Date(Number(data.period.slice(0,4)),Number(data.period.slice(5)),0).getDate();
  const meta=calendarMeta(n,3);headers=['Сотрудник','Отдел','Источник',...meta.dayHeaders];columnClasses=meta.columnClasses;
  rows=employees.map(e=>{
   const byDay=new Map((byEmployee.get(e.id)||[]).map(d=>[Number(d.date.slice(8,10)),d]));
   const source=<div className="planfact-pair planfact-source"><small className="planfact-line planfact-plan">план</small><small className="planfact-line planfact-fact">факт</small></div>;
   const values=Array.from({length:n},(_,index)=>{const day=index+1,d=byDay.get(day);return <div className="planfact-pair"><div className="planfact-line planfact-plan" aria-label={`План на ${day}`}>{d?<span className={`status status-${CODES.indexOf(d.plan)}`}>{d.plan}</span>:'—'}</div><div className="planfact-line planfact-fact" aria-label={`Факт СКУД за ${day}`}><span className="planfact-raw">{d?.raw||'—'}</span>{d?.problem&&<small className="error">Требует проверки</small>}</div></div>});
   return {key:e.id,person:e.id,className:'planfact-row',cells:[e.name,e.department,source,...values]};
  });
 }else if(primary){
  const n=new Date(Number(data.period.slice(0,4)),Number(data.period.slice(5)),0).getDate();
  const meta=calendarMeta(n,2);headers=['Сотрудник','Отдел',...meta.dayHeaders];columnClasses=meta.columnClasses;
  rows=employees.map(e=>{const byDay=new Map((byEmployee.get(e.id)||[]).map(d=>[Number(d.date.slice(8,10)),d]));return {key:e.id,person:e.id,cells:[e.name,e.department,...Array.from({length:n},(_,index)=>{const d=byDay.get(index+1);return view==='План'?(d?<span className={`status status-${CODES.indexOf(d.plan)}`}>{d.plan}</span>:'—'):(d?.raw||'—')})]}});
 }else if(view==='За месяц'){
  headers=['Сотрудник','Отдел',...CODES,'Регистрации, дней','Часы СКУД','Замечания'];rows=employees.map(e=>({key:e.id,person:e.id,cells:[e.name,e.department,...CODES.map((c,i)=><span className={`status status-${i}`}>{e.counts[c]||0}</span>),e.registered,(e.minutes/60).toFixed(2),e.issues]}));
 }else{
  headers=['Сотрудник','Отдел','Дата','План','Приход','Уход','Часы СКУД','Результат'];
  rows=days.filter(d=>view!=='Проверка данных'||d.problem).map(d=>({key:d.id+d.date,person:d.id,problem:d.problem,cells:[people.get(d.id)!.name,d.department,d.date,<span className={`status status-${CODES.indexOf(d.plan)}`}>{d.plan}</span>,d.arrival||'—',d.departure||'—',d.minutes===null?'—':(d.minutes/60).toFixed(2),d.result]}));
 }
 const showPlanLegend=['План-факт','За месяц','План','Проверка данных','По дням'].includes(view);
 return <>{view==='За месяц'&&<small className="codes-legend">О — офис · Д — дистанционная работа · Отп — отпуск · Б — больничный · От — отгул · Вых — выходной</small>}{showPlanLegend&&<section className="plan-legend" aria-label="Структура плана"><div className="plan-legend-copy"><h3>Структура плана</h3><p>Доля календарных статусов в месячном плане.</p></div><div className="status-legend">{CODES.map(code=><span key={code}><i style={{background:STATUS_COLORS[code]}}/>{code} — {STATUS_LABELS[code]}</span>)}</div></section>}<PagedTable key={view} headers={headers} rows={rows} onPerson={onPerson} printing={printing} selectable={primary} compact={primary} calendar={primary} hideSummary={primary} columnClasses={columnClasses} frozenColumns={view==='План-факт'?3:2}/></>;
}

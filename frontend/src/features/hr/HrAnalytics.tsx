import {useEffect, useMemo, useState} from 'react';
import {api, errorText} from '../../shared/api/client';

type Analytics={total:number;incomplete_cards:number;departments_without_deputy:string[];departments:string[]};
type Employee={department?:string|null;plan_department:string;employment_status?:string|null;position?:string|null};

export function HrAnalytics({employees,notify}:{employees:Employee[];notify:(message:string)=>void}){
 const [data,setData]=useState<Analytics|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{api<Analytics>('/api/hr/analytics').then(setData).catch(error=>notify(errorText(error))).finally(()=>setLoading(false))},[]);
 const departments=useMemo(()=>Object.entries(employees.reduce<Record<string,number>>((result,employee)=>{const name=employee.department||employee.plan_department;result[name]=(result[name]||0)+1;return result},{})).sort((a,b)=>b[1]-a[1]),[employees]);
 const employed=employees.filter(employee=>(employee.employment_status||'active')==='active').length;
 return <section className="hr-analytics-view">
  <div className="hr-content-head"><div><p className="eyebrow">КАДРОВЫЕ ПОКАЗАТЕЛИ</p><h2>Отчёты и аналитика</h2><p>Состав офиса, качество заполнения карточек и организационные риски.</p></div><button onClick={()=>window.print()}>Печать / PDF</button></div>
  {loading?<p role="status">Загружаем кадровую аналитику…</p>:data&&<><div className="hr-kpi-row"><article><span>Всего сотрудников</span><b>{data.total}</b><small>активный реестр</small></article><article><span>Работают</span><b>{employed}</b><small>текущий статус</small></article><article><span>Незаполненные карточки</span><b>{data.incomplete_cards}</b><small>офис, должность или дата приёма</small></article><article><span>Без заместителя</span><b>{data.departments_without_deputy.length}</b><small>отделы с руководителем</small></article></div><div className="hr-report-grid"><section className="card"><h3>Структура офиса по отделам</h3><div className="hr-bars">{departments.map(([name,count])=><div key={name}><span>{name}</span><i><b style={{width:`${Math.max(4,count/Math.max(1,employees.length)*100)}%`}}/></i><strong>{count}</strong></div>)}</div></section><section className="card"><h3>Контроль кадровых данных</h3><dl><div><dt>Отделов в реестре</dt><dd>{data.departments.length}</dd></div><div><dt>Карточек требуют заполнения</dt><dd>{data.incomplete_cards}</dd></div><div><dt>Отделов без заместителя</dt><dd>{data.departments_without_deputy.length}</dd></div></dl>{data.departments_without_deputy.length>0&&<p><b>Требуют внимания:</b> {data.departments_without_deputy.join(', ')}</p>}</section></div></>}
 </section>
}

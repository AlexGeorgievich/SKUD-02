import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {api,ApiError,download,errorText} from '../shared/api/client';
import {Brand,DataTable,Modal} from '../shared/ui';
import {filterEmployees} from '../features/analytics/model';
import {WRITERS,type Dataset,type User,type View} from '../shared/types';
import {Upload} from '../features/import/Upload';
import {Dashboard} from '../features/analytics/Dashboard';
import {BiDashboard} from '../features/analytics/BiDashboard';
import {Records} from '../features/records/Records';
import {Audit} from '../features/audit/Audit';
import {HrPage} from '../features/hr/HrPage';
import {AdminPage} from '../features/admin/AdminPage';
import {ReadOnlyEmployeeCard} from '../features/personnel/ReadOnlyEmployeeCard';
const PRIMARY_VIEWS:View[]=['План','Факт','План-факт'];
const ANALYTIC_VIEWS:View[]=['Дашборд','За месяц','Проверка данных','По дням','Аналитика и KPI'];
const SERVICE_VIEWS:View[]=['Кадровый учёт','Загрузка Excel','Журнал действий'];
const ADMIN_VIEWS:View[]=['Администрирование'];
export function Workspace({user,onLogout}:{user:User;onLogout:()=>void}){
 const [data,setData]=useState<Dataset|null>(null),[loading,setLoading]=useState(true),[view,setView]=useState<View>('Загрузка Excel');
 const [period,setPeriod]=useState('2026-08'),[department,setDepartment]=useState(''),[search,setSearch]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[cardEmployee,setCardEmployee]=useState<string|null>(null),[allDays,setAllDays]=useState(false),[busy,setBusy]=useState(false),[printing,setPrinting]=useState(false),[downloading,setDownloading]=useState(false);
 const originRef=useRef<HTMLElement|null>(null),cardLinkRef=useRef<HTMLButtonElement|null>(null);
 const notify=useCallback((s:string)=>setNotice(s),[]);
 const refresh=useCallback(async()=>{try{const r=await api<Dataset>('/api/result');setData(r);setPeriod(r.period);setDepartment('');setSearch('');return r}catch(e){if(e instanceof ApiError&&e.status===404){setData(null);return null}throw e}},[]);
 useEffect(()=>{let active=true;api<Dataset>('/api/result').then(r=>{if(active){setData(r);setPeriod(r.period)}}).catch(e=>{if(active&&!(e instanceof ApiError&&e.status===404))notify(errorText(e))}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[notify]);
 const employees=useMemo(()=>filterEmployees(data,department,search),[data,department,search]);
 const employeeIds=useMemo(()=>new Set(employees.map(e=>e.id)),[employees]);
 const visibleDays=useMemo(()=>data?.days.filter(d=>employeeIds.has(d.id))||[],[data,employeeIds]);
 const departments=useMemo(()=>[...new Set(data?.employees.map(e=>e.department)||[])],[data]);
 const primaryView=PRIMARY_VIEWS.includes(view);
 useEffect(()=>{
  function escapeUp(event:KeyboardEvent){
   if(event.key!=='Escape')return;
   if(event.defaultPrevented)return;
   if(cardEmployee){event.preventDefault();setCardEmployee(null);requestAnimationFrame(()=>cardLinkRef.current?.focus());return}
   if(selected){event.preventDefault();setSelected(null);requestAnimationFrame(()=>originRef.current?.focus());return}
   if(view==='Дашборд'&&department){event.preventDefault();setDepartment('');setSearch('')}
  }
  document.addEventListener('keydown',escapeUp);return()=>document.removeEventListener('keydown',escapeUp);
 },[view,selected,cardEmployee,department]);
 const visibleServiceViews=SERVICE_VIEWS.filter(v=>v!=='Кадровый учёт'&&(v!=='Журнал действий'||['admin','auditor'].includes(user.role)));
 function choose(v:View){setView(v);setSearch('');setNotice('')}
 const navButton=(v:View)=><button disabled={busy} className={v===view?'active':''} aria-current={v===view?'page':undefined} key={v} onClick={()=>choose(v)}>{v}</button>;
 async function exportReport(report='all',person=''){
  if(!data)return;setDownloading(true);try{await download('/api/export?'+new URLSearchParams({view:report,department,employee:person,search:person?'':search}),`TimeTrackPro_${data.period}.xlsx`)}catch(e){notify(errorText(e))}finally{setDownloading(false)}
 }
 function print(){
  const wide=['План','Факт','План-факт','За месяц','Проверка данных','По дням'].includes(view);
  const style=document.createElement('style');
  style.id='print-layout-style';
  style.textContent=`@page{size:${wide?'landscape':'portrait'};margin:${wide?'8mm 6mm':'10mm'};}`;
  document.head.appendChild(style);
  document.body.dataset.printLayout=wide?'wide':'standard';
  flushSync(()=>setPrinting(true));
  try{window.print()}finally{style.remove();delete document.body.dataset.printLayout;setPrinting(false)}
 }
 async function logout(){try{await api('/api/logout',{method:'POST'});onLogout()}catch(e){notify(errorText(e))}}
 const person=data?.employees.find(e=>e.id===selected);
 function openPerson(id:string){originRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSelected(id);setAllDays(false)}
 function closePerson(){setSelected(null);requestAnimationFrame(()=>originRef.current?.focus())}
 function closeCard(){setCardEmployee(null);requestAnimationFrame(()=>cardLinkRef.current?.focus())}
 return <><div id="workspace"><aside><Brand/><div className="role">{user.role_label}<small>{user.username}</small></div><p className="navlabel">РАБОЧЕЕ ПРОСТРАНСТВО</p><nav aria-label="Разделы"><div className="nav-group" role="group" aria-label="Кадровый учёт">{navButton('Кадровый учёт')}</div><div className="nav-group" role="group" aria-label="Учёт рабочего времени"><div className="nav-primary">{PRIMARY_VIEWS.slice(0,2).map(navButton)}<small className="nav-caption">сводные данные</small>{navButton('План-факт')}</div><div>{ANALYTIC_VIEWS.map(navButton)}</div><div>{visibleServiceViews.map(navButton)}</div></div>{user.role==='admin'&&<div className="nav-group" role="group" aria-label="Администрирование">{ADMIN_VIEWS.map(navButton)}</div>}</nav><div className="aside-foot">Excel → ETL → План–факт<br/><small>React · Локальная версия 0.3.0</small></div></aside>
 <div className="shell"><header className="workspace-topbar"><div className="filters">{!primaryView&&view!=='Кадровый учёт'&&view!=='Администрирование'&&<label><span>Отдел —</span><select aria-label="Отдел" disabled={busy||!data} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Все отделы</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label>}{view!=='Кадровый учёт'&&view!=='Администрирование'&&<label className="top-period"><span>Дата-Месяц —</span><input aria-label="Дата-Месяц" type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>}</div></header>
 <main>{notice&&<div id="notice" role="status">{notice}</div>}{!['Кадровый учёт','Администрирование'].includes(view)&&<div className={`pagehead${primaryView?' records-pagehead':''}`}><div><p className="eyebrow">УЧЁТ РАБОЧЕГО ВРЕМЕНИ</p><h2>{view}</h2><p>{data?`Загруженный период: ${data.period} · Дата анализа: ${data.asof}`:'Загрузите план и факт за один календарный месяц.'}</p></div>{primaryView&&<div className="records-head-search"><input aria-label={`Поиск по фамилии и имени · ${view}`} placeholder="Поиск по фамилии и имени" value={search} onChange={e=>setSearch(e.target.value)}/><small>{employees.length} сотрудников</small></div>}{primaryView&&<label className="records-department-filter"><span>Отдел</span><select aria-label="Отдел" disabled={busy||!data} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Все отделы</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label>}<div className="actions"><button disabled={loading||view==='Загрузка Excel'} onClick={print}>Печать</button><button disabled={!data||downloading||busy||view==='Журнал действий'} className="primary" onClick={()=>exportReport(['План-факт','За месяц','Проверка данных','По дням'].includes(view)?view:'all')}>{downloading?'Формируем Excel…':'Экспорт Excel'}</button><button disabled={busy} onClick={logout}>Выйти</button></div></div>}
 {view==='Загрузка Excel'?<Upload key={period} period={period} notify={notify} canImport={WRITERS.includes(user.role)} setImportBusy={setBusy} onComplete={async()=>{await refresh();setView('Дашборд')}}/>:
 view==='Журнал действий'?<Audit notify={notify} printing={printing}/>:
 view==='Кадровый учёт'?<HrPage role={user.role} notify={notify} onLogout={async()=>{try{await api('/api/logout',{method:'POST'});onLogout()}catch(e){notify(errorText(e))}}}/>:
 view==='Администрирование'?<AdminPage notify={notify}/>:
 loading?<div className="card" role="status">Загружаем последний результат…</div>:
 !data?<div className="card empty">Нет обработанного набора. Откройте «Загрузка Excel».</div>:
 <>{!primaryView&&<div className="card toolbar"><input aria-label="Поиск сотрудника" placeholder="Поиск по фамилии и имени" value={search} onChange={e=>setSearch(e.target.value)}/><small>{employees.length} сотрудников · Экспорт учитывает отдел и поиск</small></div>}
 {view==='Дашборд'?<BiDashboard employees={employees} days={visibleDays} department={department} unmatched={data.unmatched.length} onDepartment={value=>{setDepartment(value);setSearch('')}} onPerson={openPerson}/>:view==='Аналитика и KPI'?<Dashboard employees={employees} days={visibleDays} unmatched={data.unmatched.length} onDepartment={value=>{setDepartment(value);setSearch('');setView('За месяц')}} onPerson={openPerson}/>:<div className="card"><Records key={`${view}-${department}-${search}`} view={view} data={data} employees={employees} printing={printing} onPerson={openPerson}/></div>}</>}
 </main></div></div>
 {person&&data&&<Modal title={`${allDays?'По дням':'Проверка данных'} — ${person.name}`} headerAction={<button ref={cardLinkRef} className="detail-person-card-link" aria-label={`Открыть кадровую карточку ${person.name}`} onClick={()=>setCardEmployee(person.id)}>Кадровая карточка →</button>} onClose={closePerson}><div className="person-detail-summary"><p>{person.department} · {data.period}</p></div><div className="actions"><button onClick={()=>setAllDays(!allDays)}>{allDays?'Только замечания':'По дням'}</button><button disabled={downloading} onClick={()=>exportReport(allDays?'По дням':'Проверка данных',person.id)}>Excel сотрудника</button><button onClick={print}>Печать</button></div><DataTable headers={['Дата','План','Приход','Уход','Часы СКУД','Результат']} rows={data.days.filter(d=>d.id===person.id&&(allDays||d.problem)).map(d=>({key:d.date,problem:d.problem,cells:[d.date,d.plan,d.arrival||'—',d.departure||'—',d.minutes===null?'—':(d.minutes/60).toFixed(2),d.result]}))}/></Modal>}
 {person&&cardEmployee&&<ReadOnlyEmployeeCard employeeId={cardEmployee} employeeName={person.name} onClose={closeCard}/>}
 </>
}

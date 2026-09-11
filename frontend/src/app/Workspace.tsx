import {useCallback,useEffect,useMemo,useState} from 'react';
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
const PRIMARY_VIEWS:View[]=['План','Факт','План-факт'];
const ANALYTIC_VIEWS:View[]=['Дашборд','За месяц','Проверка данных','По дням','Аналитика и KPI'];
const SERVICE_VIEWS:View[]=['Кадровый учёт','Загрузка Excel','Журнал действий'];
export function Workspace({user,onLogout}:{user:User;onLogout:()=>void}){
 const [data,setData]=useState<Dataset|null>(null),[loading,setLoading]=useState(true),[view,setView]=useState<View>('Загрузка Excel');
 const [period,setPeriod]=useState('2026-08'),[department,setDepartment]=useState(''),[search,setSearch]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[allDays,setAllDays]=useState(false),[busy,setBusy]=useState(false),[printing,setPrinting]=useState(false),[downloading,setDownloading]=useState(false);
 const notify=useCallback((s:string)=>setNotice(s),[]);
 const refresh=useCallback(async()=>{try{const r=await api<Dataset>('/api/result');setData(r);setPeriod(r.period);setDepartment('');setSearch('');return r}catch(e){if(e instanceof ApiError&&e.status===404){setData(null);return null}throw e}},[]);
 useEffect(()=>{let active=true;api<Dataset>('/api/result').then(r=>{if(active){setData(r);setPeriod(r.period)}}).catch(e=>{if(active&&!(e instanceof ApiError&&e.status===404))notify(errorText(e))}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[notify]);
 const employees=useMemo(()=>filterEmployees(data,department,search),[data,department,search]);
 const employeeIds=useMemo(()=>new Set(employees.map(e=>e.id)),[employees]);
 const visibleDays=useMemo(()=>data?.days.filter(d=>employeeIds.has(d.id))||[],[data,employeeIds]);
 const departments=useMemo(()=>[...new Set(data?.employees.map(e=>e.department)||[])],[data]);
 useEffect(()=>{
  if(view!=='Дашборд')return;
  function escapeUp(event:KeyboardEvent){
   if(event.key!=='Escape')return;
   if(event.defaultPrevented)return;
   if(selected){event.preventDefault();setSelected(null);return}
   if(department){event.preventDefault();setDepartment('');setSearch('')}
  }
  document.addEventListener('keydown',escapeUp);return()=>document.removeEventListener('keydown',escapeUp);
 },[view,selected,department]);
 const visibleServiceViews=SERVICE_VIEWS.filter(v=>v!=='Кадровый учёт'&&(v!=='Журнал действий'||['admin','auditor'].includes(user.role)));
 function choose(v:View){setView(v);setSearch('');setNotice('')}
 const navButton=(v:View)=><button disabled={busy} className={v===view?'active':''} aria-current={v===view?'page':undefined} key={v} onClick={()=>choose(v)}>{v}</button>;
 async function exportReport(report='all',person='',anonymous=false){
  if(!data)return;setDownloading(true);try{await download('/api/export?'+new URLSearchParams({view:report,department,employee:person,anonymous:String(anonymous),search:person?'':search}),`TimeTrackPro_${data.period}${anonymous?'_anonymous':''}.xlsx`)}catch(e){notify(errorText(e))}finally{setDownloading(false)}
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
 const person=data?.employees.find(e=>e.id===selected);
 return <><div id="workspace"><aside><Brand/><div className="role">{user.role_label}<small>{user.username}</small></div><p className="navlabel">РАБОЧЕЕ ПРОСТРАНСТВО</p><nav aria-label="Разделы"><div className="nav-group" role="group" aria-label="Кадровый учёт">{navButton('Кадровый учёт')}</div><div className="nav-group" role="group" aria-label="TimeTrack"><div className="nav-primary">{PRIMARY_VIEWS.slice(0,2).map(navButton)}<small className="nav-caption">сводные данные</small>{navButton('План-факт')}</div><div>{ANALYTIC_VIEWS.map(navButton)}</div><div>{visibleServiceViews.map(navButton)}</div></div></nav><div className="aside-foot">Excel → ETL → План–факт<br/><small>React · Локальная версия 0.3.0</small></div></aside>
 <div className="shell"><header><strong>PPL Group <span className="pill">План + СКУД</span></strong><div className="filters"><label><span>Отдел —</span><select aria-label="Отдел" disabled={busy||!data} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Все отделы</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label><label><span>Дата-Месяц —</span><input aria-label="Дата-Месяц" type="month" min="2000-01" max="2099-12" disabled={busy} value={period} onChange={e=>{setPeriod(e.target.value);setView('Загрузка Excel');notify('Для нового периода загрузите соответствующую пару файлов. Текущий отчёт остаётся доступен до успешного импорта.')}}/></label><button disabled={busy} onClick={async()=>{try{await api('/api/logout',{method:'POST'});onLogout()}catch(e){notify(errorText(e))}}}>Выйти</button></div></header>
 <main>{notice&&<div id="notice" role="status">{notice}</div>}<div className="pagehead"><div><p className="eyebrow">УЧЁТ РАБОЧЕГО ВРЕМЕНИ</p><h2>{view}</h2><p>{data?`Загруженный период: ${data.period} · Дата анализа: ${data.asof}`:'Загрузите план и факт за один календарный месяц.'}</p></div><div className="actions"><button disabled={loading||view==='Загрузка Excel'} onClick={print}>Печать</button><button disabled={!data||downloading||busy||view==='Журнал действий'} className="primary" onClick={()=>exportReport(['План-факт','За месяц','Проверка данных','По дням'].includes(view)?view:'all')}>{downloading?'Формируем Excel…':'Экспорт Excel'}</button><button disabled={!data||downloading||busy||view==='Журнал действий'} onClick={()=>exportReport('all','',true)}>Без ФИ</button></div></div>
 {view==='Загрузка Excel'?<Upload key={period} period={period} notify={notify} canImport={WRITERS.includes(user.role)} setImportBusy={setBusy} onComplete={async()=>{await refresh();setView('Дашборд')}}/>:
 view==='Журнал действий'?<Audit notify={notify} printing={printing}/>:
 view==='Кадровый учёт'?<HrPage role={user.role} notify={notify}/>:
 loading?<div className="card" role="status">Загружаем последний результат…</div>:
 !data?<div className="card empty">Нет обработанного набора. Откройте «Загрузка Excel».</div>:
 <><div className="card toolbar"><input aria-label="Поиск сотрудника" placeholder="Поиск по фамилии и имени" value={search} onChange={e=>setSearch(e.target.value)}/><small>{employees.length} сотрудников · Экспорт учитывает отдел и поиск</small></div>
 {view==='Дашборд'?<BiDashboard employees={employees} days={visibleDays} department={department} unmatched={data.unmatched.length} onDepartment={value=>{setDepartment(value);setSearch('')}} onPerson={id=>{setSelected(id);setAllDays(false)}}/>:view==='Аналитика и KPI'?<Dashboard employees={employees} days={visibleDays} unmatched={data.unmatched.length} onDepartment={value=>{setDepartment(value);setSearch('');setView('За месяц')}}/>:<div className="card"><Records key={`${view}-${department}-${search}`} view={view} data={data} employees={employees} printing={printing} onPerson={id=>{setSelected(id);setAllDays(false)}}/></div>}</>}
 </main></div></div>
 {person&&data&&<Modal title={`${allDays?'По дням':'Проверка данных'} — ${person.name}`} onClose={()=>setSelected(null)}><p>{person.department} · {data.period}</p><div className="actions"><button onClick={()=>setAllDays(!allDays)}>{allDays?'Только замечания':'По дням'}</button><button disabled={downloading} onClick={()=>exportReport(allDays?'По дням':'Проверка данных',person.id)}>Excel сотрудника</button><button onClick={print}>Печать</button></div><DataTable headers={['Дата','План','Приход','Уход','Часы СКУД','Результат']} rows={data.days.filter(d=>d.id===person.id&&(allDays||d.problem)).map(d=>({key:d.date,problem:d.problem,cells:[d.date,d.plan,d.arrival||'—',d.departure||'—',d.minutes===null?'—':(d.minutes/60).toFixed(2),d.result]}))}/></Modal>}
 </>
}

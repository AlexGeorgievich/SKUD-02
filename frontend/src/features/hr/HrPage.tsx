import {useEffect, useMemo, useState} from 'react';
import {api, ApiError, errorText} from '../../shared/api/client';
import type {Role} from '../../shared/types';
import {HrOfficeStructure} from './HrOfficeStructure';
import {HrCalendar} from './HrCalendar';
import {HrAnalytics} from './HrAnalytics';

type Employee = {
  id:string; plan_name:string; plan_department:string; office?:string|null; department?:string|null;
  department_status?:string|null; gender?:string|null; birth_year?:number|null; position?:string|null;
  hire_date?:string|null; work_schedule?:string|null; department_head_id?:string|null; deputy_id?:string|null;
  deputy_from?:string|null; deputy_until?:string|null; employment_status?:string|null; personnel_number?:string|null;
  work_email?:string|null; work_phone?:string|null; access_card_number?:string|null; access_card_status?:string|null;
  access_level?:string|null;
  archived_at?:string|null; archived_by?:string|null;
};
type Tab = 'personal'|'work'|'schedule'|'access';
type SectionTab = 'employees'|'calendar'|'analytics';
const EDITORS:Role[]=['admin','hr'];
const EMPTY='—';
const DEPARTMENT_STATUSES=['Сотрудник','Руководитель отдела','Заместитель руководителя','Временно исполняющий обязанности'];
const TABS:[Tab,string][]=[['personal','Личные данные'],['work','Рабочие данные'],['schedule','Распорядок'],['access','СКУД и доступ']];

function draftFrom(employee:Employee):Record<string,string>{
 return Object.fromEntries(['plan_name','office','department','department_status','gender','birth_year','position','hire_date','work_schedule','department_head_id','deputy_id','deputy_from','deputy_until','employment_status','personnel_number','work_email','work_phone','access_card_number','access_card_status','access_level'].map(key=>[key,String(employee[key as keyof Employee]??'')]))
}
function initials(name:string){return name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span>{label}</span>{children}</label>}
function emptyEmployee():Employee{return {id:'new',plan_name:'',plan_department:'',office:'PPL Group',department:'',department_status:'Сотрудник',gender:'',birth_year:null,position:'',hire_date:'',work_schedule:'',employment_status:'active'}}

export function HrPage({role,notify}:{role:Role;notify:(message:string)=>void}){
 const [items,setItems]=useState<Employee[]>([]),[selected,setSelected]=useState<Employee|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>({}),[tab,setTab]=useState<Tab>('personal');
 const [creating,setCreating]=useState(false),[sectionTab,setSectionTab]=useState<SectionTab>('employees');
 const [confirmArchive,setConfirmArchive]=useState(false);
 const [registryMode,setRegistryMode]=useState<'active'|'archive'>('active');
 const [query,setQuery]=useState(''),[departmentFilter,setDepartmentFilter]=useState(''),[statusFilter,setStatusFilter]=useState('');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const canEdit=EDITORS.includes(role);
 const cardEditable=canEdit&&!selected?.archived_at;
 const load=(mode:'active'|'archive'=registryMode)=>{setLoading(true);api<{items:Employee[]}>(`/api/hr/employees${mode==='archive'?'?archived=true':''}`).then(r=>setItems(r.items)).catch(e=>{if(!(e instanceof ApiError&&e.status===503))notify(errorText(e))}).finally(()=>setLoading(false))};
 useEffect(()=>{load(registryMode)},[registryMode]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key==='Escape'){setSelected(null);setCreating(false);setConfirmArchive(false)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[]);
 const departments=useMemo(()=>Object.entries(items.reduce<Record<string,number>>((result,employee)=>{const department=employee.department||employee.plan_department;result[department]=(result[department]||0)+1;return result},{})).sort((a,b)=>b[1]-a[1]) as [string,number][],[items]);
 const filtered=useMemo(()=>items.filter(employee=>{
  const department=employee.department||employee.plan_department;
  const text=`${employee.plan_name} ${department} ${employee.position||''} ${employee.personnel_number||''}`.toLowerCase();
  return text.includes(query.trim().toLowerCase())&&(!departmentFilter||department===departmentFilter)&&(!statusFilter||(employee.employment_status||'active')===statusFilter)
 }),[items,query,departmentFilter,statusFilter]);
 const set=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}));
 const openCard=(employee:Employee)=>{setSelected(employee);setDraft(draftFrom(employee));setTab('personal');setConfirmArchive(false)};
 const openCreate=()=>{const employee=emptyEmployee();setSelected(employee);setDraft(draftFrom(employee));setTab('personal');setCreating(true);setConfirmArchive(false)};
 const closeCard=()=>{setSelected(null);setCreating(false);setConfirmArchive(false)};
 const saveCard=async()=>{
  if(!selected||!canEdit)return;
  const payload=Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,value===''?null:key==='birth_year'?Number(value):value]));
  setSaving(true);
  try{if(creating){const created=await api<Employee>('/api/hr/employees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});setItems(current=>[...current,created]);closeCard();setSectionTab('employees');notify('Карточка сотрудника создана')}else{const updated=await api<Employee>(`/api/hr/employees/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});setItems(current=>current.map(employee=>employee.id===updated.id?updated:employee));setSelected(updated);setDraft(draftFrom(updated));notify('Карточка сотрудника сохранена')}}
  catch(error){notify(errorText(error))}finally{setSaving(false)}
 };
 const archiveCard=async()=>{
  if(!selected||!canEdit)return;
  setSaving(true);
  try{await api(`/api/hr/employees/${selected.id}/archive`,{method:'POST'});setItems(current=>current.filter(employee=>employee.id!==selected.id));setSelected(null);setConfirmArchive(false);notify('Карточка сотрудника перемещена в архив')}
  catch(error){notify(errorText(error))}finally{setSaving(false)}
 };
 const restoreCard=async()=>{
  if(!selected||!canEdit)return;
  setSaving(true);
  try{await api(`/api/hr/employees/${selected.id}/restore`,{method:'POST'});setItems(current=>current.filter(employee=>employee.id!==selected.id));setSelected(null);notify('Карточка сотрудника восстановлена')}
  catch(error){notify(errorText(error))}finally{setSaving(false)}
 };
 const input=(key:string,type='text',placeholder='')=><input type={type} placeholder={placeholder} value={draft[key]||''} disabled={!cardEditable} onChange={event=>set(key,event.target.value)}/>;
 const employeeOptions=(exclude:string)=>items.filter(employee=>employee.id!==exclude).map(employee=><option key={employee.id} value={employee.id}>{employee.plan_name}</option>);

 return <section className="hr-workspace">
  <header className="hr-system-head"><div className="hr-system-brand"><span className="hr-brand-mark">HR</span><div><h2>HR<br/>Персонал</h2><small>Персональный учёт {items.length}+ сотрудников</small></div></div><nav className="hr-section-tabs" role="tablist" aria-label="Разделы кадрового учёта"><button role="tab" aria-selected={sectionTab==='employees'} className={sectionTab==='employees'?'active':''} onClick={()=>setSectionTab('employees')}>Сотрудники</button><button role="tab" aria-selected={sectionTab==='calendar'} className={sectionTab==='calendar'?'active':''} onClick={()=>setSectionTab('calendar')}>Календарь и юбилеи</button><button role="tab" aria-selected={sectionTab==='analytics'} className={sectionTab==='analytics'?'active':''} onClick={()=>setSectionTab('analytics')}>Отчёты и аналитика</button></nav><div className="hr-system-actions"><span>{role==='admin'?'Администратор':role==='hr'?'HR-менеджер':'Просмотр'}</span>{canEdit&&<button className="primary" aria-label="Добавить сотрудника" onClick={openCreate}>＋ Добавить сотрудника</button>}</div></header>
  {sectionTab==='employees'&&<><div className="hr-content-head"><div><p className="eyebrow">КАДРОВЫЙ УЧЁТ</p><h2>Персональный учёт сотрудников</h2><p>Управление кадровыми карточками, должностями, графиками и доступом СКУД.</p></div><div className="hr-module-actions"><button onClick={()=>window.print()}>Печать / PDF</button><button onClick={()=>load(registryMode)}>Обновить</button></div></div><HrOfficeStructure departments={departments}/><section className="card hr-registry"><div className="hr-search-row"><input aria-label="Поиск сотрудников" placeholder="Поиск по ФИО, табельному номеру, должности…" value={query} onChange={event=>setQuery(event.target.value)}/><strong>Найдено: {filtered.length}</strong></div><div className="hr-filter-row"><Field label="Отдел"><select aria-label="Фильтр по отделу" value={departmentFilter} onChange={event=>setDepartmentFilter(event.target.value)}><option value="">Все отделы ({departments.length})</option>{departments.map(([department])=><option key={department}>{department}</option>)}</select></Field><Field label="Статус сотрудника"><select aria-label="Фильтр по статусу" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">Все статусы</option><option value="active">Работает</option><option value="leave">В отпуске</option><option value="inactive">Неактивен</option></select></Field>{canEdit&&<Field label="Реестр"><select aria-label="Режим реестра" value={registryMode} onChange={event=>setRegistryMode(event.target.value as 'active'|'archive')}><option value="active">Действующие сотрудники</option><option value="archive">Архив</option></select></Field>}</div>{loading?<p role="status">Загрузка кадрового реестра…</p>:<div className="table-scroll hr-table"><table><thead><tr><th>Сотрудник</th><th>Отдел</th><th>Должность</th><th>Статус</th><th>Дата приёма</th></tr></thead><tbody>{filtered.map(employee=><tr key={employee.id}><td><button className="hr-person" aria-label={employee.plan_name} onClick={()=>openCard(employee)}><span className="hr-avatar small">{initials(employee.plan_name)}</span><span><b>{employee.plan_name}</b><small>{employee.personnel_number||'Табельный номер не указан'}</small></span></button></td><td>{employee.department||employee.plan_department}</td><td>{employee.position||EMPTY}</td><td>{employee.archived_at?<span className="hr-status archived">Архив</span>:<span className={`hr-status ${(employee.employment_status||'active')}`}>{employee.employment_status==='inactive'?'Неактивен':employee.employment_status==='leave'?'В отпуске':'Работает'}</span>}</td><td>{employee.hire_date||EMPTY}</td></tr>)}</tbody></table></div>}</section></>}
  {sectionTab==='calendar'&&<HrCalendar employees={items} notify={notify} onOpen={id=>{const employee=items.find(item=>item.id===id);if(employee)openCard(employee)}}/>}
  {sectionTab==='analytics'&&<HrAnalytics employees={items} notify={notify}/>}
  {selected&&<div className="modal-backdrop" role="presentation" onMouseDown={closeCard}><div className="hr-employee-modal" role="dialog" aria-modal="true" aria-label={creating?'Новая карточка сотрудника':`Карточка сотрудника ${selected.plan_name}`} onMouseDown={event=>event.stopPropagation()}>
   <header className="hr-card-head"><div><span className="hr-head-dot"/><div><h3>{creating?'Новый сотрудник':selected.plan_name}</h3><p>{creating?'Заполните обязательные поля и сохраните карточку':`${selected.department||selected.plan_department} · ${selected.position||'Должность не указана'}`}</p></div></div><div>{selected.archived_at?<span className="hr-readonly">Карточка в архиве</span>:!canEdit&&<span className="hr-readonly">Только просмотр</span>}<button className="modal-close" onClick={closeCard} aria-label="Закрыть">×</button></div></header>
   <div className="hr-card-tabs" role="tablist">{TABS.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
   <div className="hr-card-body"><aside className="hr-photo-panel"><div className="hr-avatar photo" aria-label="Фото сотрудника">{initials(draft.plan_name||selected.plan_name)||'НС'}</div><b>{draft.plan_name||selected.plan_name||'Новый сотрудник'}</b><small>{selected.personnel_number||'Табельный номер не указан'}</small><span className={`hr-status ${selected.employment_status||'active'}`}>{selected.employment_status==='inactive'?'Неактивен':selected.employment_status==='leave'?'В отпуске':'Работает'}</span></aside>
    <div className="hr-form-panel">
     {tab==='personal'&&<div className="hr-form-grid"><Field label="ФИО из плана"><input value={draft.plan_name||''} disabled={!creating} autoFocus={creating} onChange={event=>set('plan_name',event.target.value)}/></Field><Field label="Офис">{input('office')}</Field><Field label="Отдел">{input('department')}</Field><Field label="Пол"><select value={draft.gender||''} disabled={!cardEditable} onChange={event=>set('gender',event.target.value)}><option value="">Не указан</option><option>Женский</option><option>Мужской</option></select></Field><Field label="Год рождения">{input('birth_year','number')}</Field><Field label="Дата приёма">{input('hire_date','date')}</Field></div>}
     {tab==='work'&&<div className="hr-form-grid"><Field label="Должность">{input('position')}</Field><Field label="Статус в отделе"><select value={draft.department_status||''} disabled={!cardEditable} onChange={event=>set('department_status',event.target.value)}><option value="">Не указан</option>{DEPARTMENT_STATUSES.map(status=><option key={status}>{status}</option>)}</select></Field><Field label="Статус занятости"><select value={draft.employment_status||'active'} disabled={!cardEditable} onChange={event=>set('employment_status',event.target.value)}><option value="active">Работает</option><option value="leave">В отпуске</option><option value="inactive">Неактивен</option></select></Field><Field label="Руководитель отдела"><select value={draft.department_head_id||''} disabled={!cardEditable} onChange={event=>set('department_head_id',event.target.value)}><option value="">Не назначен</option>{employeeOptions(selected.id)}</select></Field><Field label="Заместитель"><select value={draft.deputy_id||''} disabled={!cardEditable} onChange={event=>set('deputy_id',event.target.value)}><option value="">Не назначен</option>{employeeOptions(selected.id)}</select></Field><Field label="Замещение с">{input('deputy_from','date')}</Field><Field label="Замещение по">{input('deputy_until','date')}</Field></div>}
     {tab==='schedule'&&<div className="hr-form-grid"><Field label="Распорядок работы">{input('work_schedule','text','Например, 5/2, 09:00–18:00')}</Field></div>}
     {tab==='access'&&<div className="hr-form-grid"><Field label="Табельный номер">{input('personnel_number')}</Field><Field label="Рабочий email">{input('work_email','email')}</Field><Field label="Рабочий телефон">{input('work_phone','tel')}</Field><Field label="Номер карты СКУД">{input('access_card_number')}</Field><Field label="Статус карты">{input('access_card_status')}</Field><Field label="Уровень доступа">{input('access_level')}</Field></div>}
    </div>
   </div>
   <footer className="hr-card-footer">{confirmArchive?<div className="hr-archive-confirm"><span>Карточка исчезнет из активного реестра, но история сохранится.</span><button onClick={()=>setConfirmArchive(false)}>Отмена</button><button className="danger" disabled={saving} onClick={archiveCard}>Подтвердить архивирование</button></div>:<><small>Esc — закрыть карточку</small><div>{selected.archived_at&&canEdit?<button className="primary" disabled={saving} onClick={restoreCard}>{saving?'Восстанавливаем…':'Восстановить'}</button>:<>{canEdit&&!creating&&<button className="danger-link" onClick={()=>setConfirmArchive(true)}>В архив</button>}<button onClick={closeCard}>{canEdit?'Отмена':'Закрыть'}</button>{canEdit&&<button className="primary" disabled={saving||(creating&&(!draft.plan_name?.trim()||!draft.department?.trim()))} onClick={saveCard}>{saving?'Сохраняем…':'Сохранить'}</button>}</>}</div></>}</footer>
  </div></div>}
 </section>
}

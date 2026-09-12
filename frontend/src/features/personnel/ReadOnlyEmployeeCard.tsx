import {useEffect,useRef,useState} from 'react';
import {api,ApiError,errorText} from '../../shared/api/client';

type EmployeeCard={
 id:string;plan_name:string;plan_department?:string|null;office?:string|null;department?:string|null;
 position?:string|null;department_status?:string|null;gender?:string|null;birth_year?:number|null;hire_date?:string|null;
 work_schedule?:string|null;employment_status?:string|null;personnel_number?:string|null;work_email?:string|null;
 work_phone?:string|null;access_card_number?:string|null;access_card_status?:string|null;access_level?:string|null;mode?:string;
};
type Tab='personal'|'work'|'schedule'|'access';
const TABS:[Tab,string][]=[['personal','Личные данные'],['work','Рабочие данные'],['schedule','Распорядок'],['access','СКУД и доступ']];
const EMPTY='Не заполнено';
function initials(name:string){return name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}
function Value({label,value}:{label:string;value:unknown}){return <div className="hr-readonly-field"><small>{label}</small><strong>{value===null||value===undefined||value===''?EMPTY:String(value)}</strong></div>}

export function ReadOnlyEmployeeCard({employeeId,employeeName,onClose}:{employeeId:string;employeeName:string;onClose:()=>void}){
 const [employee,setEmployee]=useState<EmployeeCard|null>(null),[error,setError]=useState(''),[tab,setTab]=useState<Tab>('personal');
 const dialogRef=useRef<HTMLDialogElement>(null);
 const nativeDialog=typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype.showModal==='function';
 useEffect(()=>{let active=true;async function load(){try{const value=await api<EmployeeCard>(`/api/hr/employees/${encodeURIComponent(employeeId)}/read-only?source=timetrack&name=${encodeURIComponent(employeeName)}`);if(active)setEmployee(value)}catch(reason){if(!active)return;if(reason instanceof ApiError&&reason.status===404){try{const registry=await api<{items:EmployeeCard[]}>('/api/hr/employees');const match=registry.items.find(item=>item.plan_name.trim().toLocaleLowerCase()===employeeName.trim().toLocaleLowerCase());if(active&&match)setEmployee({...match,mode:'read-only'});else if(active)setError('Кадровая карточка сотрудника не найдена. Данные УВР остаются открыты.')}catch(fallbackError){if(active)setError(errorText(fallbackError))}}else setError(errorText(reason))}}load();return()=>{active=false}},[employeeId,employeeName]);
 useEffect(()=>{const dialog=dialogRef.current;if(dialog&&typeof dialog.showModal==='function')dialog.showModal();return()=>{if(dialog&&typeof dialog.close==='function')dialog.close()}},[]);
 const name=employee?.plan_name||employeeName;
 return <dialog ref={dialogRef} open={nativeDialog?undefined:true} className="hr-employee-modal timetrack-readonly-card" aria-label={`Кадровая карточка сотрудника ${name}`} onCancel={event=>{event.preventDefault();onClose()}}>
  <header className="hr-card-head"><div><span className="hr-head-dot"/><div><h3>{name}</h3><p>{employee?`${employee.department||employee.plan_department||EMPTY} · ${employee.position||'Должность не указана'}`:'Загрузка кадровых данных…'}</p></div></div><div><span className="hr-readonly">Только просмотр</span><button className="modal-close" onClick={onClose} aria-label="Вернуться в УВР">×</button></div></header>
  <div className="hr-card-tabs" role="tablist">{TABS.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  <div className="hr-card-body"><aside className="hr-photo-panel"><div className="hr-avatar photo" aria-label="Фото сотрудника">{initials(name)||'—'}</div><b>{name}</b><small>{employee?.personnel_number||'Табельный номер не указан'}</small><span className={`hr-status ${employee?.employment_status||'active'}`}>{employee?.employment_status==='inactive'?'Неактивен':employee?.employment_status==='leave'?'В отпуске':'Работает'}</span></aside>
   <div className="hr-form-panel">{error?<div className="hr-card-error" role="alert"><h3>Карточка недоступна</h3><p>{error}</p></div>:!employee?<p role="status">Загружаем кадровую карточку…</p>:<div className="hr-readonly-grid">
    {tab==='personal'&&<><Value label="ФИО из плана" value={employee.plan_name}/><Value label="Офис" value={employee.office}/><Value label="Отдел" value={employee.department||employee.plan_department}/><Value label="Пол" value={employee.gender}/><Value label="Год рождения" value={employee.birth_year}/><Value label="Дата приёма" value={employee.hire_date}/></>}
    {tab==='work'&&<><Value label="Должность" value={employee.position}/><Value label="Статус в отделе" value={employee.department_status}/><Value label="Статус занятости" value={employee.employment_status}/></>}
    {tab==='schedule'&&<Value label="Распорядок работы" value={employee.work_schedule}/>} 
    {tab==='access'&&<><Value label="Табельный номер" value={employee.personnel_number}/><Value label="Рабочий email" value={employee.work_email}/><Value label="Рабочий телефон" value={employee.work_phone}/><Value label="Номер карты СКУД" value={employee.access_card_number}/><Value label="Статус карты" value={employee.access_card_status}/><Value label="Уровень доступа" value={employee.access_level}/></>}
   </div>}</div>
  </div>
  <footer className="hr-card-footer"><small>Esc — вернуться к информации УВР</small><div><button className="primary" onClick={onClose}>Вернуться в УВР</button></div></footer>
 </dialog>
}

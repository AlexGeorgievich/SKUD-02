import type {HrCatalogsData,HrEmployee} from './hrTypes';

function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?'hr-field-wide':undefined}><span>{label}</span>{children}</label>}

export function HrWorkFields({employee,draft,disabled,catalogs,employees,onChange}:{employee:HrEmployee;draft:Record<string,string>;disabled:boolean;catalogs:HrCatalogsData;employees:HrEmployee[];onChange:(key:string,value:string)=>void}){
 const input=(key:string,type='text')=><input type={type} value={draft[key]||''} disabled={disabled} onChange={event=>onChange(key,event.target.value)}/>;
 const departments=catalogs.departments.filter(item=>!draft.office_id||!item.office_id||item.office_id===draft.office_id);
 const leaders=employees.filter(item=>item.id!==employee.id&&(draft.department_id?item.department_id===draft.department_id:(item.department||item.plan_department)===draft.department));
 const workFormats=catalogs.values.filter(item=>item.kind==='work_format'&&['Фиксированный','Свободный','Гибкий'].includes(item.label||''));
 return <div className="hr-form-grid">
  <Field label="Юридическое лицо"><select value={draft.legal_entity_id||''} disabled={disabled} onChange={event=>onChange('legal_entity_id',event.target.value)}><option value="">Не выбрано</option>{catalogs.legal_entities.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Офис"><select value={draft.office_id||''} disabled={disabled} onChange={event=>{const office=catalogs.offices.find(item=>item.id===event.target.value);onChange('office_id',event.target.value);onChange('office',office?.name||'');const selected=catalogs.departments.find(item=>item.id===draft.department_id);if(selected?.office_id&&selected.office_id!==event.target.value){onChange('department_id','');onChange('department','')}}}><option value="">Не выбран</option>{catalogs.offices.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Отдел"><select value={draft.department_id||''} disabled={disabled} onChange={event=>{const item=departments.find(value=>value.id===event.target.value);onChange('department_id',event.target.value.startsWith('legacy:')?'':event.target.value);onChange('department',item?.name||'')}}><option value="">Выберите отдел</option>{departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Должность"><select value={draft.position_id||''} disabled={disabled} onChange={event=>{const item=catalogs.positions.find(value=>value.id===event.target.value);onChange('position_id',event.target.value);onChange('position',item?.label||item?.name||'')}}><option value="">Не выбрана</option>{catalogs.positions.map(item=><option key={item.id} value={item.id}>{item.label||item.name}</option>)}</select></Field>
  <Field label="Должность английская">{input('position_en')}</Field>
  <Field label="Дата приёма">{input('hire_date','date')}</Field>
  <Field label="Испытательный срок"><select value={draft.employment_type||'permanent'} disabled={disabled} onChange={event=>onChange('employment_type',event.target.value)}><option value="permanent">Нет</option><option value="probation">Да</option></select></Field>
  {draft.employment_type==='probation'&&<Field label="Дата окончания ИС">{input('probation_end_date','date')}</Field>}
  <Field label="Формат работы"><select value={draft.work_format_id||''} disabled={disabled} onChange={event=>onChange('work_format_id',event.target.value)}><option value="">Не выбран</option>{workFormats.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
  <Field label="Руководитель отдела"><select value={draft.department_head_id||''} disabled={disabled} onChange={event=>onChange('department_head_id',event.target.value)}><option value="">Не назначен</option>{leaders.map(item=><option key={item.id} value={item.id}>{item.plan_name}</option>)}</select></Field>
  <Field label="Заместитель"><select value={draft.deputy_id||''} disabled={disabled} onChange={event=>onChange('deputy_id',event.target.value)}><option value="">Не назначен</option>{leaders.map(item=><option key={item.id} value={item.id}>{item.plan_name}</option>)}</select></Field>
  <Field label="Замещение с">{input('deputy_from','date')}</Field>
  <Field label="Замещение по">{input('deputy_until','date')}</Field>
  <Field wide label="Круг задач и направления"><textarea value={draft.responsibility||''} disabled={disabled} onChange={event=>onChange('responsibility',event.target.value)}/></Field>
 </div>;
}

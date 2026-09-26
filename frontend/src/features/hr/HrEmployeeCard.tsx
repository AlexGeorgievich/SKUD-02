import type {HrCatalogsData,HrEmployee} from './hrTypes';

function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?'hr-field-wide':undefined}><span>{label}</span>{children}</label>}

export function HrEmployeeCard({employee,catalogs,mode,draft,onChange}:{employee:HrEmployee;catalogs:HrCatalogsData;mode:'edit'|'read-only';draft:Record<string,string>;onChange:(key:string,value:string)=>void}){
 const disabled=mode==='read-only';
 const nameChange=(key:string,value:string)=>{const next={...draft,[key]:value};onChange(key,value);onChange('plan_name',[next.family_name,next.given_name,next.patronymic].filter(Boolean).join(' '))};
 const departments=catalogs.departments.length?catalogs.departments.map(item=>({id:item.id,name:item.name||''})):[{id:draft.department,name:draft.department}].filter(item=>item.name);
 return <div className="hr-form-grid">
  <Field label="Фамилия"><input autoFocus={employee.id==='new'} value={draft.family_name||''} disabled={disabled} onChange={event=>nameChange('family_name',event.target.value)}/></Field>
  <Field label="Имя"><input value={draft.given_name||''} disabled={disabled} onChange={event=>nameChange('given_name',event.target.value)}/></Field>
  <Field label="Отчество"><input value={draft.patronymic||''} disabled={disabled} onChange={event=>nameChange('patronymic',event.target.value)}/></Field>
  <Field label="ФИО"><input value={draft.plan_name||''} disabled={disabled} onChange={event=>onChange('plan_name',event.target.value)}/></Field>
  <Field label="Офис"><select value={draft.office_id||''} disabled={disabled} onChange={event=>{const office=catalogs.offices.find(item=>item.id===event.target.value);onChange('office_id',event.target.value);onChange('office',office?.name||'')}}><option value="">Не выбран</option>{catalogs.offices.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Отдел"><select value={draft.department_id||departments.find(item=>item.name===draft.department)?.id||''} disabled={disabled} onChange={event=>{const item=departments.find(value=>value.id===event.target.value);onChange('department_id',event.target.value.startsWith('legacy:')?'':event.target.value);onChange('department',item?.name||event.target.value)}}><option value="">Выберите отдел</option>{departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Юридическое лицо"><select value={draft.legal_entity_id||''} disabled={disabled} onChange={event=>onChange('legal_entity_id',event.target.value)}><option value="">Не выбрано</option>{catalogs.legal_entities.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Формат работы"><select value={draft.work_format_id||''} disabled={disabled} onChange={event=>onChange('work_format_id',event.target.value)}><option value="">Не выбран</option>{catalogs.values.filter(item=>item.kind==='work_format').map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
  <Field label="Пол"><select value={draft.gender_id||''} disabled={disabled} onChange={event=>onChange('gender_id',event.target.value)}><option value="">Не указан</option>{catalogs.values.filter(item=>item.kind==='gender').map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
  <Field label="Год рождения"><input type="date" value={draft.birth_date||''} disabled={disabled} onChange={event=>onChange('birth_date',event.target.value)}/></Field>
  <Field label="Дата приёма"><input type="date" value={draft.hire_date||''} disabled={disabled} onChange={event=>onChange('hire_date',event.target.value)}/></Field>
  <Field label="ТГ"><input value={draft.telegram||''} disabled={disabled} placeholder="@username" onChange={event=>onChange('telegram',event.target.value)}/></Field>
  <Field label="Личный телефон"><input type="tel" value={draft.personal_phone||''} disabled={disabled} onChange={event=>onChange('personal_phone',event.target.value)}/></Field>
  <Field label="Ссылка на фото"><input type="url" value={draft.photo_source_url||''} disabled={disabled} onChange={event=>onChange('photo_source_url',event.target.value)}/></Field>
  <Field label="Страховка"><input value={draft.insurance||''} disabled={disabled} onChange={event=>onChange('insurance',event.target.value)}/></Field>
  <Field wide label="Круг задач и направления"><textarea value={draft.responsibility||''} disabled={disabled} onChange={event=>onChange('responsibility',event.target.value)}/></Field>
  <Field label="Образование"><input value={draft.education_institution||''} disabled={disabled} onChange={event=>onChange('education_institution',event.target.value)}/></Field>
  <Field label="Специальность"><input value={draft.education_specialty||''} disabled={disabled} onChange={event=>onChange('education_specialty',event.target.value)}/></Field>
  <Field label="Год окончания"><input type="date" value={draft.education_graduation_date||''} disabled={disabled} onChange={event=>onChange('education_graduation_date',event.target.value)}/></Field>
 </div>
}

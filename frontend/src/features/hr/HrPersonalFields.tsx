import type {HrCatalogsData} from './hrTypes';
import {formatPersonalPhone,normalizePersonalPhoneInput} from './contactFormat';

function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?'hr-field-wide':undefined}><span>{label}</span>{children}</label>}

export function HrPersonalFields({draft,disabled,catalogs,onChange}:{draft:Record<string,string>;disabled:boolean;catalogs:HrCatalogsData;onChange:(key:string,value:string)=>void}){
 const nameChange=(key:string,value:string)=>{const next={...draft,[key]:value};onChange(key,value);onChange('plan_name',[next.family_name,next.given_name].filter(Boolean).join(' '))};
 const input=(key:string,type='text',placeholder='')=><input type={type} value={draft[key]||''} disabled={disabled} placeholder={placeholder} onChange={event=>onChange(key,event.target.value)}/>;
 const genderValues=catalogs.values.filter(item=>item.kind==='gender'&&(item.label==='Мужской'||item.label==='Женский'));
 return <div className="hr-form-grid">
  <Field label="Фамилия"><input autoFocus value={draft.family_name||''} disabled={disabled} onChange={event=>nameChange('family_name',event.target.value)}/></Field>
  <Field label="Имя"><input value={draft.given_name||''} disabled={disabled} onChange={event=>nameChange('given_name',event.target.value)}/></Field>
  <Field label="Отчество"><input value={draft.patronymic||''} disabled={disabled} onChange={event=>nameChange('patronymic',event.target.value)}/></Field>
  <Field label="ФИО"><input value={draft.plan_name||''} readOnly aria-readonly="true"/></Field>
  <Field label="Пол"><select value={draft.gender_id||''} disabled={disabled} onChange={event=>onChange('gender_id',event.target.value)}><option value="">Выберите пол</option>{genderValues.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
  <Field label="Год рождения">{input('birth_date','date')}</Field>
  <Field label="Место рождения">{input('birth_place')}</Field>
  <Field label="Образование">{input('education_institution')}</Field>
  <Field label="Специальность">{input('education_specialty')}</Field>
  <Field label="Год окончания">{input('education_graduation_date','date')}</Field>
  <Field label="Учёная степень">{input('academic_degree')}</Field>
  <Field label="ТГ">{input('telegram','text','@username')}</Field>
  <Field label="Личный телефон"><input type="tel" value={formatPersonalPhone(draft.personal_phone||'')} disabled={disabled} placeholder="+7 (___) ___-__-__" onChange={event=>onChange('personal_phone',normalizePersonalPhoneInput(event.target.value))}/></Field>
  <Field label="Рабочая почта">{input('work_email','email','name@example.ru')}</Field>
  <Field label="Рекомендация">{input('recommendation')}</Field>
  <Field label="Рекрутер HR">{input('recruiter')}</Field>
  <Field label="Визитка">{input('business_card')}</Field>
  <Field label="Стаж работы">{input('work_experience','text','Например, 5 лет 2 месяца')}</Field>
  <Field label="Ссылка на фото">{input('photo_source_url','url')}</Field>
  <Field label="Картинка в почте">{input('mail_image_url','url')}</Field>
  <Field label="Страховка">{input('insurance')}</Field>
  <Field wide label="Комментарии"><textarea value={draft.comments||''} disabled={disabled} placeholder="Дополнительные сведения" onChange={event=>onChange('comments',event.target.value)}/></Field>
 </div>;
}

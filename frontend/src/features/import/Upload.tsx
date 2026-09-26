import {useState} from 'react';
import {api,download,errorText,localDate} from '../../shared/api/client';
import {DataTable,FileDrop} from '../../shared/ui';
import type {Preview} from '../../shared/types';
import {KusSourceReview} from './KusSourceReview';

export function Upload({period,onComplete,notify,canImport,setImportBusy}:{period:string;onComplete:()=>Promise<void>;notify:(m:string)=>void;canImport:boolean;setImportBusy:(b:boolean)=>void}){
 const [plan,setPlan]=useState<File|null>(null),[fact,setFact]=useState<File|null>(null),[control,setControl]=useState<File|null>(null),[preview,setPreview]=useState<Preview|null>(null),[asof,setAsof]=useState(localDate()),[busy,setBusy]=useState(false),[demoBusy,setDemoBusy]=useState(false),[controlSummary,setControlSummary]=useState<{version:number|null;employees:number;active_hours:number;useful_hours:number;hh_minutes:number}|null>(null),[calculation,setCalculation]=useState<{version:number;source_versions:Record<string,number>;employees:{employee_id:string;employee_name:string;department:string;minutes:number;registered_days:number;issues:number;control?:{active_hours:number|null;useful_hours:number|null;hh_minutes:number|null}|null}[]}|null>(null),[calculationBusy,setCalculationBusy]=useState(false);
 async function refreshControlSummary(){try{setControlSummary(await api(`/api/uvr/periods/${period}/control-summary`))}catch(error){notify(errorText(error))}}
 async function calculateHistory(){setCalculationBusy(true);try{const result=await api<typeof calculation>(`/api/uvr/periods/${period}/calculate?asof=${encodeURIComponent(asof)}`,{method:'POST'});setCalculation(result);notify(`Месячный план–факт рассчитан, версия ${result?.version}`)}catch(error){notify(errorText(error))}finally{setCalculationBusy(false)}}
 async function send(previewOnly:boolean){
  if(!plan||!fact){notify('Нужны оба файла');return}
  if(!asof){notify('Укажите дату анализа');return}
  setBusy(true);setImportBusy(true);setPreview(null);notify(previewOnly?'Проверяем структуру файлов…':'Выполняется обработка. Дождитесь результата…');
  const fd=new FormData();fd.append('plan',plan);fd.append('fact',fact);fd.append('period',period);fd.append('asof',asof);fd.append('preview',String(previewOnly));
  try{
   if(previewOnly){const p=await api<Preview>('/api/import',{method:'POST',body:fd});setPreview(p);notify(`План: ${p.plan_count}, факт: ${p.fact_count} сотрудников. Показаны первые 8 строк.`)}
   else{const r=await api<{employees:number;unmatched:number}>('/api/import',{method:'POST',body:fd});await onComplete();notify(`Обработано ${r.employees} сотрудников. Вне плана: ${r.unmatched}.`)}
  }catch(e){notify(errorText(e))}finally{setBusy(false);setImportBusy(false)}
 }
 return <><div className="card toolbar"><div><strong>Тестовый набор PPL Group</strong><p>17 отделов · 166 сотрудников · Faker · график 5/2</p></div><button disabled={demoBusy||busy} onClick={async()=>{setDemoBusy(true);try{await download('/api/demo?'+new URLSearchParams({period}),'demo-inputs.zip')}catch(e){notify(errorText(e))}finally{setDemoBusy(false)}}}>{demoBusy?'Генерируем файлы…':'Скачать 2 тестовых файла (ZIP)'}</button></div>
 {!canImport?<div className="card">Для вашей роли импорт недоступен. Просмотр загруженных данных — через меню.</div>:<>
 <div className="uploadgrid"><FileDrop title="01 / План работ" file={plan} disabled={busy} onError={notify} onFile={f=>{setPlan(f);setPreview(null)}}/><FileDrop title="02 / СКУД_факт" file={fact} disabled={busy} onError={notify} onFile={f=>{setFact(f);setPreview(null)}}/></div>
 <div className="card"><div className="toolbar"><label>Дата анализа<input type="date" value={asof} max={localDate()} disabled={busy} onChange={e=>setAsof(e.target.value)}/></label><div className="actions"><button disabled={busy||!plan||!fact} onClick={()=>send(true)}>Проверить и просмотреть</button><button disabled={busy||!plan||!fact} className="primary" onClick={()=>send(false)}>{busy?'Обработка…':'Обработать план–факт →'}</button></div></div><small>Период B2. Заголовок плана — строка 4, факта — строка 9. Повторный импорт заменит последний набор.</small>{busy&&<p role="status">Читаем Excel и выполняем проверку. Можно дождаться завершения без повторного нажатия.</p>}</div>
 {preview&&(['plan','fact'] as const).map(k=><div className="card" key={k}><h2>{k==='plan'?'План':'Факт'}: предварительный просмотр</h2><DataTable headers={['Сотрудник','Отдел','День 1','День 2','День 3']} rows={preview[k].map((r,i)=>({key:String(i),cells:[r.name,r.department,...r.values.slice(0,3)]}))}/></div>)}
 <section className="card uvr-source-import"><p className="eyebrow">ИСТОРИЯ ПО МЕСЯЦАМ</p><h2>Сопоставить файлы с карточками КУС</h2><p>Preview показывает точные совпадения и требует ручного выбора для неоднозначных и неизвестных строк. Применение сохраняет неизменяемую версию файла за выбранный месяц.</p>
  <KusSourceReview period={period} kind="plan" file={plan} notify={notify} onApplied={()=>setCalculation(null)}/><KusSourceReview period={period} kind="fact" file={fact} notify={notify} onApplied={()=>setCalculation(null)}/>
  <div className="uvr-control-select"><label>Отчёт службы контроля (СК)<input type="file" accept=".xlsx" aria-label="Файл отчёта СК" disabled={busy} onChange={event=>{setControl(event.target.files?.[0]||null);setControlSummary(null)}}/></label><KusSourceReview period={period} kind="control" file={control} notify={notify} onApplied={()=>void refreshControlSummary()}/></div>
  {controlSummary?.version!==undefined&&controlSummary.version!==null&&<div className="card"><h3>Отчёт СК · версия {controlSummary.version}</h3><p>Сотрудников: {controlSummary.employees} · активность: {controlSummary.active_hours.toFixed(1)} ч · полезная: {controlSummary.useful_hours.toFixed(1)} ч · hh.ru: {controlSummary.hh_minutes} мин</p></div>}
  <div className="card"><div className="toolbar"><div><h3>Расчёт истории Plan–факт</h3><p>Используется выбранная дата анализа и последние применённые версии Plan/СКУД; связь — по UUID карточек КУС.</p></div><button className="primary" disabled={calculationBusy} onClick={()=>void calculateHistory()}>{calculationBusy?'Считаем…':'Рассчитать месячный план–факт'}</button></div>
   {calculation&&<><p>Расчёт версии {calculation.version}. Версии источников: {Object.entries(calculation.source_versions).map(([kind,version])=>`${kind} v${version}`).join(' · ')}</p><DataTable headers={['Сотрудник','Отдел','Регистраций','Часы СКУД','Замечания','Активность СК, ч','Полезная активность, ч','hh.ru, мин']} rows={calculation.employees.map(row=>({key:row.employee_id,cells:[row.employee_name,row.department,row.registered_days,(row.minutes/60).toFixed(1),row.issues,row.control?.active_hours??'—',row.control?.useful_hours??'—',row.control?.hh_minutes??'—']}))} compact/></>}
  </div>
 </section>
 </>}
 </>
}

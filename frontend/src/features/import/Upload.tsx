import {useState} from 'react';
import {api,download,errorText,localDate} from '../../shared/api/client';
import {DataTable,FileDrop} from '../../shared/ui';
import type {Preview} from '../../shared/types';

export function Upload({period,onComplete,notify,canImport,setImportBusy}:{period:string;onComplete:()=>Promise<void>;notify:(m:string)=>void;canImport:boolean;setImportBusy:(b:boolean)=>void}){
 const [plan,setPlan]=useState<File|null>(null),[fact,setFact]=useState<File|null>(null),[preview,setPreview]=useState<Preview|null>(null),[asof,setAsof]=useState(localDate()),[busy,setBusy]=useState(false),[demoBusy,setDemoBusy]=useState(false);
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
 </>}
 </>
}

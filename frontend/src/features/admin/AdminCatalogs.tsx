import {useEffect,useState} from 'react';
import {api,errorText} from '../../shared/api/client';

type CatalogItem={id:string;name:string;employee_count:number;department_count?:number;head_count?:number;office_id?:string|null;head_id?:string|null};
type CatalogData={legal_entities:CatalogItem[];offices:CatalogItem[];departments:CatalogItem[];positions:CatalogItem[]};
type Employee={id:string;plan_name:string;department_id?:string|null};
type Kind=keyof CatalogData;
const GROUPS:{kind:Kind;title:string;single:string}[]=[
 {kind:'legal_entities',title:'Юридические лица',single:'юридическое лицо'},
 {kind:'offices',title:'Офисы',single:'офис'},
 {kind:'departments',title:'Отделы',single:'отдел'},
 {kind:'positions',title:'Должности',single:'должность'},
];
const EMPTY:CatalogData={legal_entities:[],offices:[],departments:[],positions:[]};

export function AdminCatalogs({notify}:{notify:(message:string)=>void}){
 const [catalogs,setCatalogs]=useState<CatalogData>(EMPTY),[employees,setEmployees]=useState<Employee[]>([]),[loading,setLoading]=useState(true);
 const [editing,setEditing]=useState<{kind:Kind;id?:string;name:string;office_id:string;head_id:string}|null>(null),[deleting,setDeleting]=useState<{kind:Kind;item:CatalogItem}|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const load=()=>{setLoading(true);return Promise.all([api<CatalogData>('/api/admin/catalogs'),api<{items:Employee[]}>('/api/hr/employees')]).then(([data,people])=>{setCatalogs(data);setEmployees(people.items)}).catch(reason=>{const message=errorText(reason);setError(message);notify(message)}).finally(()=>setLoading(false))};
 useEffect(()=>{void load()},[]);
 const begin=(kind:Kind,item?:CatalogItem)=>setEditing({kind,id:item?.id,name:item?.name||'',office_id:item?.office_id||'',head_id:item?.head_id||''});
 const save=async()=>{if(!editing?.name.trim())return;setSaving(true);setError('');try{const body:{name:string;office_id?:string|null;head_id?:string|null}={name:editing.name.trim()};if(editing.kind==='departments'){body.office_id=editing.office_id||null;body.head_id=editing.head_id||null}await api(`/api/admin/catalogs/${editing.kind}${editing.id?`/${editing.id}`:''}`,{method:editing.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setEditing(null);await load();notify('Справочник сохранён')}catch(reason){const message=errorText(reason);setError(message);notify(message)}finally{setSaving(false)}};
 const remove=async()=>{if(!deleting)return;setSaving(true);setError('');try{await api(`/api/admin/catalogs/${deleting.kind}/${deleting.item.id}`,{method:'DELETE'});setDeleting(null);await load();notify('Значение справочника удалено')}catch(reason){const message=errorText(reason);setError(message);notify(message);setDeleting(null)}finally{setSaving(false)}};
 return <section className="admin-catalogs">
  <header className="pagehead"><div><p className="eyebrow">СТРУКТУРА КУС</p><h2>Справочники кадрового учёта</h2><p>Значения используются HR при заполнении карточек сотрудников.</p></div><button onClick={()=>void load()}>Обновить</button></header>
  {error&&<p className="admin-catalog-error" role="alert">{error}</p>}
  {loading?<p role="status">Загружаем справочники…</p>:<div className="admin-catalog-grid">{GROUPS.map(group=><section className="card admin-catalog-card" key={group.kind}><header><h3>{group.title}</h3><button className="primary" aria-label={`Добавить ${group.single}`} onClick={()=>begin(group.kind)}>＋ Добавить</button></header>{catalogs[group.kind].length?<ul>{catalogs[group.kind].map(item=><li key={item.id}><div><b>{item.name}</b><small>Сотрудников: {item.employee_count}{item.department_count!==undefined?` · Отделов: ${item.department_count}`:''}{item.head_count?` · Руководитель назначен`:''}</small></div><span><button aria-label={`Редактировать ${item.name}`} onClick={()=>begin(group.kind,item)}>Изменить</button><button className="danger-link" aria-label={`Удалить ${item.name}`} onClick={()=>setDeleting({kind:group.kind,item})}>Удалить</button></span></li>)}</ul>:<p>Значения пока не заведены.</p>}</section>)}</div>}
  {editing&&<div className="modal-backdrop" role="presentation"><div className="admin-catalog-modal" role="dialog" aria-modal="true" aria-label={editing.id?'Редактирование справочника':'Новое значение справочника'}><header><h3>{editing.id?'Редактирование':'Новое значение'}</h3><button className="modal-close" aria-label="Закрыть" onClick={()=>setEditing(null)}>×</button></header><label><span>Название</span><input autoFocus value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})}/></label>{editing.kind==='departments'&&<><label><span>Офис</span><select value={editing.office_id} onChange={event=>setEditing({...editing,office_id:event.target.value})}><option value="">Не выбран</option>{catalogs.offices.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Руководитель отдела</span><select value={editing.head_id} onChange={event=>setEditing({...editing,head_id:event.target.value})}><option value="">Не назначен</option>{employees.filter(item=>!editing.id||item.department_id===editing.id).map(item=><option key={item.id} value={item.id}>{item.plan_name}</option>)}</select></label></>}<footer><button onClick={()=>setEditing(null)}>Отмена</button><button className="primary" disabled={saving||!editing.name.trim()} onClick={()=>void save()}>Сохранить</button></footer></div></div>}
  {deleting&&<div className="admin-delete-confirm" role="alertdialog" aria-label="Подтверждение удаления"><span>Подтвердите удаление «{deleting.item.name}». Используемое значение удалить нельзя до переназначения.</span><button onClick={()=>setDeleting(null)}>Отмена</button><button className="danger" disabled={saving} onClick={()=>void remove()}>Подтвердить удаление</button></div>}
 </section>;
}

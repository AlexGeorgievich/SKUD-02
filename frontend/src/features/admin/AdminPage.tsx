import {useEffect,useState} from 'react';
import {api,errorText} from '../../shared/api/client';
import {AdminCatalogs} from './AdminCatalogs';

type User={username:string;role:string;department:string};
type Backup={id:string;filename?:string;size?:number;checksum?:string};
type Tab='users'|'catalogs'|'backups';

export function AdminPage({notify}:{notify:(message:string)=>void}){
 const [tab,setTab]=useState<Tab>('users'),[users,setUsers]=useState<User[]>([]),[backups,setBackups]=useState<Backup[]>([]),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false);
 const loadUsers=()=>{setLoading(true);api<{items:User[]}>('/api/admin/users').then(result=>setUsers(result.items)).catch(error=>notify(errorText(error))).finally(()=>setLoading(false))};
 const loadBackups=()=>{setLoading(true);api<{items?:Backup[]}>('/api/admin/backups').then(result=>setBackups(result.items||[])).catch(()=>setBackups([])).finally(()=>setLoading(false))};
 useEffect(()=>{if(tab==='users')loadUsers();else if(tab==='backups')loadBackups()},[tab]);
 const createBackup=async()=>{setCreating(true);try{const backup=await api<Backup>('/api/admin/backups',{method:'POST'});setBackups(current=>[backup,...current]);notify('Резервная копия создана и проверена')}catch(error){notify(errorText(error))}finally{setCreating(false)}};
 return <section className="card hr-page admin-page">
  <div className="pagehead"><div><p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p><h2>Сопровождение системы</h2><p>Пользователи, справочники кадрового учёта и резервные копии.</p></div></div>
  <nav className="admin-tabs" role="tablist" aria-label="Разделы администрирования"><button role="tab" aria-selected={tab==='users'} className={tab==='users'?'active':''} onClick={()=>setTab('users')}>Пользователи</button><button role="tab" aria-selected={tab==='catalogs'} className={tab==='catalogs'?'active':''} onClick={()=>setTab('catalogs')}>Справочники</button><button role="tab" aria-selected={tab==='backups'} className={tab==='backups'?'active':''} onClick={()=>setTab('backups')}>Резервные копии</button></nav>
  {tab==='catalogs'?<AdminCatalogs notify={notify}/>:loading?<p role="status">Загружаем данные администрирования…</p>:tab==='users'?<section className="card"><div className="pagehead"><h3>Пользователи и уровни доступа</h3><button onClick={loadUsers}>Обновить</button></div><div className="table-scroll"><table><thead><tr><th>Пользователь</th><th>Роль</th><th>Отдел</th></tr></thead><tbody>{users.map(user=><tr key={user.username}><td>{user.username}</td><td>{user.role}</td><td>{user.department||'—'}</td></tr>)}</tbody></table></div></section>:<section className="card"><div className="pagehead"><div><h3>Резервное копирование БД</h3><p>Копия PostgreSQL проверяется перед добавлением в список.</p></div><button className="primary" disabled={creating} onClick={()=>void createBackup()}>{creating?'Создаём…':'Создать backup'}</button></div><div className="table-scroll"><table><thead><tr><th>Идентификатор</th><th>Файл</th><th>Размер</th><th>Контрольная сумма</th></tr></thead><tbody>{backups.length?backups.map(backup=><tr key={backup.id}><td>{backup.id}</td><td>{backup.filename||'—'}</td><td>{backup.size??'—'}</td><td>{backup.checksum||'—'}</td></tr>):<tr><td colSpan={4}>Резервные копии ещё не созданы.</td></tr>}</tbody></table></div></section>}
 </section>;
}

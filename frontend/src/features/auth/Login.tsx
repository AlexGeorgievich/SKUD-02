import {useState} from 'react';
import {api,errorText} from '../../shared/api/client';
import type {User} from '../../shared/types';
import {Brand} from '../../shared/ui';
export function Login({onLogin}:{onLogin:(user:User)=>void}){
 const [username,setUsername]=useState('admin'),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <section className="portal"><div className="brand-panel"><Brand/><div><p className="eyebrow">КОРПОРАТИВНОЕ РАБОЧЕЕ ПРОСТРАНСТВО</p><h1>Хороший день<br/>начинается<br/>с <em>ясного плана.</em></h1><p>Планирование, учёт времени и сверка СКУД.<br/>Единое пространство для вашей команды.</p></div><small>Локальная версия · PPL Group</small></div><div className="auth"><p className="eyebrow">PPL GROUP / TIMETRACK PRO</p><h2>Вход в рабочее пространство</h2><p>Используйте учётную запись, созданную при запуске.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});setPassword('');onLogin(await api<User>('/api/me'))}catch(err){setError(errorText(err))}finally{setBusy(false)}}}>
 <label>Логин<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Пароль<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="primary">{busy?'Выполняется вход…':'Войти в систему →'}</button>{error&&<p className="error" role="alert">{error}</p>}</form><small>Права назначает администратор. Самостоятельная регистрация отключена.</small></div></section>
}


import {useEffect,useState} from 'react';
import {api,ApiError,errorText} from '../shared/api/client';
import type {User} from '../shared/types';
import {Login} from '../features/auth/Login';
import {Workspace} from './Workspace';
export default function App(){
 const [user,setUser]=useState<User|null>(null),[checking,setChecking]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;const expired=()=>setUser(null);window.addEventListener('session-expired',expired);api<User>('/api/me').then(u=>{if(active)setUser(u)}).catch(e=>{if(active&&!(e instanceof ApiError&&e.status===401))setError(errorText(e))}).finally(()=>{if(active)setChecking(false)});return ()=>{active=false;window.removeEventListener('session-expired',expired)}},[]);
 if(checking)return <div className="empty" role="status">Открываем TimeTrack Pro…</div>;
 return user?<Workspace user={user} onLogout={()=>setUser(null)}/>:<>{error&&<div role="alert" className="card error">{error}</div>}<Login onLogin={setUser}/></>;
}

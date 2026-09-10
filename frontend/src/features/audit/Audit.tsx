import {useEffect,useState} from 'react';
import {api,errorText} from '../../shared/api/client';
import type {GridRow} from '../../shared/ui';
import {PagedTable} from '../../shared/ui/PagedTable';
export function Audit({notify,printing}:{notify:(s:string)=>void;printing:boolean}){
 const [rows,setRows]=useState<GridRow[]|null>(null);
 useEffect(()=>{let active=true;api<{time:string;user:string;action:string}[]>('/api/audit').then(r=>{if(active)setRows(r.map((x,i)=>({key:String(i),cells:[x.time,x.user,x.action]})))}).catch(e=>{if(active)notify(errorText(e))});return ()=>{active=false}},[notify]);
 return rows?<PagedTable headers={['Время','Пользователь','Действие']} rows={rows} printing={printing}/>:<div className="card">Загружаем журнал…</div>;
}


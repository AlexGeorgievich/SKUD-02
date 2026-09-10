import {useEffect,useState} from 'react';
import {CODES,STATUS_COLORS,STATUS_LABELS,type Day,type Employee} from '../../shared/types';
import {summarize} from './model';
import {Modal} from '../../shared/ui';

interface DailyPoint{date:string;label:string;office:number;registered:number;issues:number;hours:number}
function dailySeries(days:Day[]):DailyPoint[]{
 const dates=[...new Set(days.map(d=>d.date))].sort();
 return dates.map(date=>{
  const rows=days.filter(d=>d.date===date);
  return {date,label:`${date.slice(8,10)}.${date.slice(5,7)}`,office:rows.filter(d=>d.plan==='О').length,registered:rows.filter(d=>d.registered).length,issues:rows.filter(d=>d.problem).length,hours:rows.reduce((n,d)=>n+(d.minutes??0),0)/60};
 });
}

function Kpis({employees}:{employees:Employee[]}){
 const s=summarize(employees);
 const cards=[
  ['Сотрудников',s.people,'По ключевой таблице плана'],
  ['Подтверждение О',s.ratio===null?'—':`${s.ratio}%`,`${s.confirmed} из ${s.office} офисных дней`],
  ['Часы присутствия',(s.minutes/60).toFixed(1),'СКУД, без вычета перерывов'],
  ['Замечания',s.issues,'События для проверки, не оценка прогула']
 ];
 return <div className="kpis bi-kpis">{cards.map(([label,value,note])=><div className="card bi-kpi-card" key={label}><p>{label}</p><b>{value}</b><small>{note}</small></div>)}</div>;
}

function DailyChart({points}:{points:DailyPoint[]}){
 const width=760,height=220,left=42,right=18,top=18,bottom=34,plotW=width-left-right,plotH=height-top-bottom;
 const max=Math.max(1,...points.flatMap(p=>[p.office,p.registered]));
 const x=(i:number)=>left+(points.length<2?plotW/2:i*plotW/(points.length-1));
 const y=(value:number)=>top+plotH-value*plotH/max;
 const line=(key:'office'|'registered')=>points.map((p,i)=>`${x(i)},${y(p[key])}`).join(' ');
 const tickEvery=Math.max(1,Math.ceil(points.length/7));
 return <div className="card bi-card daily-chart"><h3>Динамика по дням</h3><p>Плановые дни «О» и сотрудники с хотя бы одной регистрацией.</p><div className="chart-legend"><span><i className="legend-office"/>План О</span><span><i className="legend-registered"/>Регистрации</span></div><svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика по дням"><title>Динамика по дням</title>{[0,.25,.5,.75,1].map(v=><g key={v}><line x1={left} x2={width-right} y1={top+plotH*(1-v)} y2={top+plotH*(1-v)} className="chart-grid"/><text x={left-8} y={top+plotH*(1-v)+4} textAnchor="end">{Math.round(max*v)}</text></g>)}{points.length>0&&<><polyline points={line('office')} className="series-office"/><polyline points={line('registered')} className="series-registered"/>{points.map((p,i)=><g key={p.date}><circle cx={x(i)} cy={y(p.office)} r="4" className="point-office" aria-label={`${p.label}: план О — ${p.office}; регистрации — ${p.registered}`}/><circle cx={x(i)} cy={y(p.registered)} r="4" className="point-registered" aria-hidden="true"/>{(i%tickEvery===0||i===points.length-1)&&<text x={x(i)} y={height-9} textAnchor="middle">{p.label}</text>}</g>)}</>}</svg></div>;
}

function OfficeStructurePie({groups,onDepartment}:{groups:{name:string;people:number}[];onDepartment:(name:string)=>void}){
 const width=760,height=230,cx=145,cy=115,r=92,total=Math.max(1,groups.reduce((sum,g)=>sum+g.people,0));let angle=-Math.PI/2;
 const colors=['#3b82f6','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#94a3b8'];
 const point=(a:number)=>({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});
 return <div className="card bi-card office-structure"><h3>Структура офиса по штату</h3><p>Распределение сотрудников по отделам.</p><div className="office-structure-content"><svg className="office-pie" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Структура офиса по штату"><title>Структура офиса по штату</title>{groups.map((group,index)=>{const next=angle+2*Math.PI*group.people/total,start=point(angle),end=point(next),large=next-angle>Math.PI,path=group.people?`M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large?1:0} 1 ${end.x} ${end.y} Z`:`M ${cx} ${cy} Z`;angle=next;return <path key={group.name} d={path} fill={colors[index%colors.length]} onClick={()=>onDepartment(group.name)} role="button" aria-label={`${group.name}: ${group.people} сотрудников`}><title>{group.name}: {group.people} сотрудников</title></path>})}</svg><div className="office-legend">{groups.map((group,index)=><button key={group.name} className="department-link" onClick={()=>onDepartment(group.name)}><i style={{background:colors[index%colors.length]}}/>{group.name}<b>{group.people}</b></button>)}</div></div></div>;
}

function OfficeStructureTreemap({groups,onDepartment}:{groups:{name:string;people:number}[];onDepartment:(name:string)=>void}){
 const width=760,height=250,total=Math.max(1,groups.reduce((sum,g)=>sum+g.people,0));
 const ordered=[...groups].sort((a,b)=>b.people-a.people),largest=ordered[0],leftWidth=largest?Math.max(170,Math.round(width*largest.people/total)):0,right=ordered.slice(1),rightTotal=Math.max(1,right.reduce((sum,g)=>sum+g.people,0));let y=0;
 const colors=['#3b82f6','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#94a3b8'];
 return <div className="card bi-card office-structure"><h3>Структура офиса по штату</h3><p>Распределение сотрудников по отделам. Площадь блока пропорциональна численности.</p><div className="office-structure-content"><div className="office-legend">{ordered.map((group,index)=><button key={group.name} className="department-link" onClick={()=>onDepartment(group.name)}><i className="office-legend-swatch" style={{background:colors[index%colors.length]}}/>{group.name}<b>{group.people}</b></button>)}</div><svg className="office-treemap" viewBox="0 0 760 250" role="img" aria-label="Treemap структуры офиса по штату"><title>Treemap структуры офиса по штату</title>{largest&&<g><rect x="0" y="0" width={leftWidth} height={height} fill={colors[0]} onClick={()=>onDepartment(largest.name)}/><title>{largest.name}: {largest.people} сотрудников</title>{leftWidth>180&&<text x={leftWidth/2} y={height/2} textAnchor="middle" className="treemap-label">{largest.name} · {largest.people}</text>}</g>}{right.map((group,index)=>{const h=height*group.people/rightTotal,top=y;y+=h;return <g key={group.name}><rect x={leftWidth+4} y={top} width={Math.max(1,width-leftWidth-4)} height={Math.max(1,h-4)} fill={colors[(index+1)%colors.length]} onClick={()=>onDepartment(group.name)}/><title>{group.name}: {group.people} сотрудников</title>{h>34&&<text x={leftWidth+(width-leftWidth)/2} y={top+h/2} textAnchor="middle" className="treemap-label">{group.name} · {group.people}</text>}</g>})}</svg></div></div>;
}

interface OfficeTileRect{name:string;people:number;x:number;y:number;width:number;height:number}
function layoutOfficeTiles(groups:{name:string;people:number}[],x=0,y=0,width=100,height=100):OfficeTileRect[]{
 const items=groups.filter(group=>group.people>0);
 if(!items.length)return [];
 if(items.length===1)return [{...items[0],x,y,width,height}];
 const total=items.reduce((sum,item)=>sum+item.people,0),target=total/2;
 let firstTotal=items[0].people,splitAt=1,best=Math.abs(firstTotal-target);
 for(let index=1;index<items.length-1;index++){firstTotal+=items[index].people;const distance=Math.abs(firstTotal-target);if(distance<best){best=distance;splitAt=index+1}}
 const first=items.slice(0,splitAt),second=items.slice(splitAt),ratio=first.reduce((sum,item)=>sum+item.people,0)/total;
 if(width>=height){const firstWidth=width*ratio;return [...layoutOfficeTiles(first,x,y,firstWidth,height),...layoutOfficeTiles(second,x+firstWidth,y,width-firstWidth,height)]}
 const firstHeight=height*ratio;return [...layoutOfficeTiles(first,x,y,width,firstHeight),...layoutOfficeTiles(second,x,y+firstHeight,width,height-firstHeight)];
}

function OfficeStructureGrid({groups,onDepartment}:{groups:{name:string;people:number}[];onDepartment:(name:string)=>void}){
 const ordered=[...groups].sort((a,b)=>b.people-a.people),colors=['#3b82f6','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#94a3b8'];
 const tiles=layoutOfficeTiles(ordered),total=Math.max(1,ordered.reduce((sum,group)=>sum+group.people,0)),rowHeight=Math.min(24,440/Math.max(1,ordered.length));
 return <div className="card bi-card office-structure"><h3>Структура офиса по штату</h3><p>Распределение сотрудников по отделам. Площадь плитки пропорциональна численности.</p><div className="office-structure-content"><div className="office-legend office-legend-fit" style={{gridAutoRows:`${rowHeight}px`}}>{ordered.map((group,index)=><button key={group.name} className="department-link" onClick={()=>onDepartment(group.name)} title={`${group.name}: ${group.people} сотрудников`}><i className="office-legend-swatch" style={{background:colors[index%colors.length]}}/><span>{group.name}</span><b>{group.people}</b></button>)}</div><div className="office-treemap-surface" role="img" aria-label="Treemap структуры офиса по штату">{tiles.map((tile,index)=><button key={tile.name} className="office-tile" data-share={100*tile.people/total} style={{position:'absolute',left:`${tile.x}%`,top:`${tile.y}%`,width:`${tile.width}%`,height:`${tile.height}%`,background:colors[index%colors.length]}} onClick={()=>onDepartment(tile.name)} title={`${tile.name}: ${tile.people} сотрудников`}><span>{tile.name}</span><b>{tile.people}</b></button>)}</div></div></div>;
}

interface PlanTileRect{code:string;value:number;x:number;y:number;width:number;height:number}
function layoutPlanTiles(items:{code:string;value:number}[],x=0,y=0,width=760,height=230):PlanTileRect[]{
 const visible=items.filter(item=>item.value>0);
 if(!visible.length)return [];
 if(visible.length===1)return [{...visible[0],x,y,width,height}];
 const total=visible.reduce((sum,item)=>sum+item.value,0),target=total/2;
 let firstTotal=visible[0].value,splitAt=1,best=Math.abs(firstTotal-target);
 for(let index=1;index<visible.length-1;index++){firstTotal+=visible[index].value;const distance=Math.abs(firstTotal-target);if(distance<best){best=distance;splitAt=index+1}}
 const first=visible.slice(0,splitAt),second=visible.slice(splitAt),ratio=first.reduce((sum,item)=>sum+item.value,0)/total;
 if(width>=height){const firstWidth=width*ratio;return [...layoutPlanTiles(first,x,y,firstWidth,height),...layoutPlanTiles(second,x+firstWidth,y,width-firstWidth,height)]}
 const firstHeight=height*ratio;return [...layoutPlanTiles(first,x,y,width,firstHeight),...layoutPlanTiles(second,x,y+firstHeight,width,height-firstHeight)];
}

function PlanTreemap({group}:{group:{name:string;counts:Record<string,number>}}){
 const width=760,height=230,tiles=layoutPlanTiles(CODES.map(code=>({code,value:group.counts[code]||0}))),total=Math.max(1,CODES.reduce((sum,code)=>sum+(group.counts[code]||0),0));
 return <div className="plan-treemap-layout"><svg className="plan-treemap" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Treemap структуры плана: ${group.name}`}><title>Treemap структуры плана: {group.name}</title>{tiles.map(tile=>{const canLabel=tile.width>100&&tile.height>44,centerX=tile.x+tile.width/2,centerY=tile.y+tile.height/2;return <g key={tile.code}><rect x={tile.x} y={tile.y} width={tile.width} height={tile.height} fill={STATUS_COLORS[tile.code]}/><title>{tile.code} — {STATUS_LABELS[tile.code]}: {tile.value} ({Math.round(100*tile.value/total)}%)</title>{canLabel&&<><text x={centerX} y={centerY-5} textAnchor="middle" className="plan-treemap-code">{tile.code} — {STATUS_LABELS[tile.code]}</text><text x={centerX} y={centerY+18} textAnchor="middle" className="plan-treemap-value">{tile.value}</text></>}</g>})}</svg><div className="plan-treemap-legend">{CODES.map(code=><div key={code}><i style={{background:STATUS_COLORS[code]}}/><span>{code} — {STATUS_LABELS[code]}</span><b>{group.counts[code]||0}</b></div>)}</div></div>;
}

function StatusStacks({groups,onDepartment}:{groups:{name:string;counts:Record<string,number>}[];onDepartment?:(name:string)=>void}){
 return <div className="card bi-card"><h3>Структура плана</h3><p>Доля календарных статусов в месячном плане.</p>{groups.length===1?<><div className="treemap-title">{onDepartment?<button className="department-link" onClick={()=>onDepartment(groups[0].name)}>{groups[0].name}</button>:<strong>{groups[0].name}</strong>}</div><PlanTreemap group={groups[0]}/></>:<><div className="status-legend">{CODES.map(code=><span key={code}><i style={{background:STATUS_COLORS[code]}}/>{code} — {STATUS_LABELS[code]}</span>)}</div><div className="stack-list">{groups.map(group=>{const total=CODES.reduce((n,c)=>n+(group.counts[c]||0),0);return <div className="stack-row" key={group.name}><div>{onDepartment?<button className="department-link" onClick={()=>onDepartment(group.name)}>{group.name}</button>:<strong>{group.name}</strong>}</div><div className="stack-track" aria-label={`Структура плана: ${group.name}`}>{CODES.map(code=>{const value=group.counts[code]||0;return value?<span key={code} style={{width:`${100*value/Math.max(total,1)}%`,background:STATUS_COLORS[code]}} title={`${STATUS_LABELS[code]}: ${value}`}/>:null})}</div><small>{total}</small></div>})}</div></>}</div>;
}

function ConfirmationBars({groups,onDepartment}:{groups:{name:string;ratio:number|null;confirmed:number;office:number}[];onDepartment:(name:string)=>void}){
 const [open,setOpen]=useState(true);
 return <div className="card bi-card collapsible-panel"><button className="collapse-head" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span role="heading" aria-level={3}>Подтверждение офисных дней по отделам</span><span className="collapse-chevron" aria-hidden="true">{open?'⌄':'>'}</span></button>{open&&<><p>Сопоставимый показатель: регистрации / прошедшие плановые дни «О».</p><div className="rank-bars">{[...groups].sort((a,b)=>(b.ratio??-1)-(a.ratio??-1)).map(g=><div className="rank-row" key={g.name}><button className="department-link" onClick={()=>onDepartment(g.name)}>{g.name}</button><div className="rank-track"><span style={{width:`${g.ratio??0}%`}}/></div><b>{g.ratio===null?'—':`${g.ratio}%`}</b><small>{g.confirmed}/{g.office}</small></div>)}</div></>}</div>;
}

function IssueHeatmap({days,employees,onDepartment}:{days:Day[];employees:Employee[];onDepartment:(name:string)=>void}){
 const [selection,setSelection]=useState<{department:string;date:string}|null>(null),dates=[...new Set(days.map(d=>d.date))].sort(),departments=[...new Set(days.map(d=>d.department))].sort();
 const max=Math.max(1,...departments.flatMap(dep=>dates.map(date=>days.filter(d=>d.department===dep&&d.date===date&&d.problem).length))),details=selection?days.filter(day=>day.department===selection.department&&day.date===selection.date&&day.problem):[],names=new Map(employees.map(employee=>[employee.id,employee.name]));
 useEffect(()=>{function closeDetails(event:KeyboardEvent){if(event.key==='Escape'&&selection){event.preventDefault();event.stopImmediatePropagation();setSelection(null)}}document.addEventListener('keydown',closeDetails);return()=>document.removeEventListener('keydown',closeDetails)},[selection]);
 const selectedLabel=selection?`${selection.date.slice(8,10)}.${selection.date.slice(5,7)}.${selection.date.slice(0,4)}`:'';
 return <div className="card bi-card heatmap-card heatmap-card-wide"><h3>Карта замечаний</h3><p>Весь месяц: насыщенность показывает число записей для проверки. Щелчок по цветной ячейке открывает исходные записи; это не классификация прогулов.</p><div className="heatmap" role="region" aria-label="Карта замечаний"><div className="heatmap-grid" style={{gridTemplateColumns:`minmax(150px,220px) repeat(${dates.length},24px)`}}><span/>{dates.map(d=><small key={d}>{d.slice(8,10)}</small>)}{departments.flatMap(dep=>[<button key={`${dep}-name`} className="department-link" onClick={()=>onDepartment(dep)}>{dep}</button>,...dates.map(date=>{const value=days.filter(d=>d.department===dep&&d.date===date&&d.problem).length;return <button key={`${dep}-${date}`} className="heat-cell" disabled={!value} onClick={()=>setSelection({department:dep,date})} style={{background:`rgba(239,68,68,${value?0.18+0.72*value/max:0.04})`}} aria-label={`${dep}, ${date}: замечаний ${value}`} title={value?`${dep} · ${date}: открыть ${value} записей`:`${dep} · ${date}: замечаний нет`}/>})])}</div></div>{selection&&<Modal title={`Расшифровка замечаний · ${selection.department} · ${selectedLabel}`} onClose={()=>setSelection(null)}><table className="compact-table heatmap-details-table"><thead><tr><th>Сотрудник</th><th>План</th><th>Факт СКУД</th><th>Приход</th><th>Уход</th><th>Часы</th><th>Замечание</th></tr></thead><tbody>{details.map(day=><tr key={`${day.id}-${day.date}`}><td>{names.get(day.id)||day.id}</td><td>{day.plan}</td><td className="heatmap-raw">{day.raw||'—'}</td><td>{day.arrival||'—'}</td><td>{day.departure||'—'}</td><td>{day.minutes===null?'—':(day.minutes/60).toFixed(2)}</td><td>{day.issue||day.result}</td></tr>)}</tbody></table><small>Esc или «Закрыть» — закрыть расшифровку.</small></Modal>}</div>;
}

function EmployeeIssues({employees,onPerson}:{employees:Employee[];onPerson:(id:string)=>void}){
 const ranked=[...employees].sort((a,b)=>b.issues-a.issues||a.name.localeCompare(b.name,'ru')).slice(0,12),max=Math.max(1,...ranked.map(e=>e.issues));
 return <div className="card bi-card"><h3>Рейтинг сотрудников по замечаниям</h3><p>Переход ведёт к подневным исходным строкам сотрудника.</p><div className="rank-bars">{ranked.map(e=><div className="rank-row employee-rank" key={e.id}><button className="person-link" onClick={()=>onPerson(e.id)}>{e.name}</button><div className="rank-track issue"><span style={{width:`${100*e.issues/max}%`}}/></div><b>{e.issues}</b></div>)}</div></div>;
}

function HoursHistogram({employees}:{employees:Employee[]}){
 const bins=[{label:'0 ч',min:0,max:0},{label:'1–80 ч',min:0,max:80},{label:'81–120 ч',min:80,max:120},{label:'121–160 ч',min:120,max:160},{label:'160+ ч',min:160,max:Infinity}];
 const values=bins.map((bin,i)=>({label:bin.label,count:employees.filter(e=>{const h=e.minutes/60;return i===0?h===0:h>bin.min&&h<=bin.max}).length})),max=Math.max(1,...values.map(v=>v.count));
 return <div className="card bi-card"><h3>Распределение часов присутствия</h3><p>Часы СКУД по сотрудникам; показатель не является оценкой продуктивности.</p><div className="histogram" role="img" aria-label="Распределение часов присутствия">{values.map(v=><div key={v.label}><b>{v.count}</b><span style={{height:`${Math.max(4,120*v.count/max)}px`}}/><small>{v.label}</small></div>)}</div></div>;
}

export function BiDashboard({employees,days,department,unmatched,onDepartment,onPerson}:{employees:Employee[];days:Day[];department:string;unmatched:number;onDepartment:(name:string)=>void;onPerson:(id:string)=>void}){
 const daily=dailySeries(days),departments=[...new Set(employees.map(e=>e.department))];
 const departmentGroups=departments.map(name=>{const people=employees.filter(e=>e.department===name),s=summarize(people);return {name,people:people.length,counts:Object.fromEntries(CODES.map(c=>[c,people.reduce((n,e)=>n+(e.counts[c]||0),0)])),ratio:s.ratio,confirmed:s.confirmed,office:s.office}});
 const title=department||'Все отделы';
 return <section className="bi-dashboard" aria-label={`BI-дашборд: ${title}`}><div className="bi-title"><div><h2>BI-дашборд · {title}</h2><p>Источник: расчётный набор «За месяц» и подневная детализация. Часы отражают присутствие СКУД.</p></div><div className="bi-title-actions">{department&&<small className="bi-back-hint">Esc — Все отделы</small>}{unmatched>0&&<small>Вне плана: {unmatched}</small>}</div></div><Kpis employees={employees}/><OfficeStructureGrid groups={departmentGroups} onDepartment={onDepartment}/><div className="bi-grid"><DailyChart points={daily}/>{department?<StatusStacks groups={departmentGroups}/>:<ConfirmationBars groups={departmentGroups.map(g=>({name:g.name,ratio:g.ratio,confirmed:g.confirmed,office:g.office}))} onDepartment={onDepartment}/>} {department?<><EmployeeIssues employees={employees} onPerson={onPerson}/><HoursHistogram employees={employees}/></>:<><StatusStacks groups={departmentGroups} onDepartment={onDepartment}/><IssueHeatmap days={days} employees={employees} onDepartment={onDepartment}/></>}</div></section>;
}

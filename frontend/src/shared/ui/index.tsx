import {useEffect,useRef,useState,type ReactNode} from 'react';

export function Brand(){return <div className="brand"><b className="logo">T</b><span>TimeTrack Pro<small>PPL GROUP</small></span></div>}

export interface GridRow {key:string; cells:ReactNode[]; person?:string; problem?:boolean; className?:string}
export function DataTable({headers,rows,onPerson,selectable=false,compact=false,calendar=false,columnClasses=[],frozenColumns=2,calendarStart=0}:{headers:ReactNode[];rows:GridRow[];onPerson?:(id:string)=>void;selectable?:boolean;compact?:boolean;calendar?:boolean;columnClasses?:string[];frozenColumns?:number;calendarStart?:number}){
 const [selected,setSelected]=useState<string|null>(null);const rowRefs=useRef(new Map<string,HTMLTableRowElement>()),wrapRef=useRef<HTMLDivElement>(null);
 function focusRow(key:string){const row=rowRefs.current.get(key);row?.focus();if(typeof row?.scrollIntoView==='function')row.scrollIntoView({block:'nearest'})}
 function keyDown(event:React.KeyboardEvent<HTMLTableRowElement>){
  if(!selectable)return;
  if(event.key==='Enter'){const row=rows.find(r=>r.key===selected);if(event.target===event.currentTarget&&row?.person){event.preventDefault();onPerson?.(row.person)}return}
  if(event.key==='Escape'){event.preventDefault();setSelected(null);return}
  if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
  event.preventDefault();const current=Math.max(0,rows.findIndex(r=>r.key===selected));const next=Math.max(0,Math.min(rows.length-1,current+(event.key==='ArrowDown'?1:-1))),key=rows[next]?.key;
  if(key){setSelected(key);focusRow(key)}
 }
 function horizontalKeyDown(event:React.KeyboardEvent<HTMLDivElement>){
  if(!calendar||(event.key!=='ArrowLeft'&&event.key!=='ArrowRight'))return;
  event.preventDefault();const wrap=wrapRef.current;if(!wrap)return;const limit=Math.max(0,wrap.scrollWidth-wrap.clientWidth),step=80;wrap.scrollLeft=Math.max(0,Math.min(limit,wrap.scrollLeft+(event.key==='ArrowRight'?step:-step)));
 }
 useEffect(()=>{if(calendar&&wrapRef.current)wrapRef.current.scrollLeft=calendarStart*80},[calendar,calendarStart]);
 const columnClass=(index:number)=>`${calendar&&index<frozenColumns?'calendar-frozen ':''}${columnClasses[index]||''}`.trim();
 return <div ref={wrapRef} onKeyDown={horizontalKeyDown} data-calendar-start={calendar?calendarStart:undefined} className={`tablewrap${compact?' compact-table':''}${selectable?' selectable-table':''}${calendar?' calendar-table':''}`}><table><thead><tr>{headers.map((h,i)=><th key={i} scope="col" className={columnClass(i)}>{h}</th>)}</tr></thead><tbody>{rows.map(r=>{const isSelected=selected===r.key;return <tr ref={node=>{if(node)rowRefs.current.set(r.key,node);else rowRefs.current.delete(r.key)}} key={r.key} className={`${r.person?'employee':''} ${r.problem?'problem':''} ${r.className||''}`} aria-selected={selectable?isSelected:undefined} tabIndex={selectable?(isSelected?0:-1):undefined} onKeyDown={keyDown} onClick={event=>{if(selectable){setSelected(r.key);event.currentTarget.focus()}else if(r.person)onPerson?.(r.person)}}>{r.cells.map((c,i)=><td key={i} className={columnClass(i)}>{i===0&&r.person?<button className="person-link" onClick={e=>{e.stopPropagation();onPerson?.(r.person!)}}>{c}</button>:c}</td>)}</tr>})}</tbody></table>{!rows.length&&<div className="empty">Нет записей по выбранным условиям</div>}</div>
}

export function FileDrop({title,file,onFile,disabled=false,onError}:{title:string;file:File|null;onFile:(file:File)=>void;disabled?:boolean;onError:(message:string)=>void}){
 const [over,setOver]=useState(false);
 function accept(files:FileList|null){if(!files?.length)return;if(files.length!==1){onError('Выберите один файл для этой области');return}const f=files[0];if(!f.name.toLowerCase().endsWith('.xlsx')){onError('Поддерживаются только файлы .xlsx');return}if(f.size>20*1024*1024){onError('Файл превышает 20 МБ');return}onFile(f)}
 return <div className="card"><h2>{title}</h2><label className={`drop ${over?'over':''}`} onDragOver={e=>{e.preventDefault();if(!disabled)setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);if(!disabled)accept(e.dataTransfer.files)}}><span aria-hidden="true">⇧</span><strong>Перетащите Excel сюда</strong><span>или выберите файл на компьютере</span><span className="file-picker-row"><span className="file-picker-button" aria-hidden="true">Обзор…</span><span className="filename">{file?`Выбран файл: ${file.name} · ${(file.size/1024).toFixed(1)} КБ`:'Файл не выбран'}</span></span><input className="file-input" type="file" aria-label={title} accept=".xlsx" disabled={disabled} onChange={e=>{accept(e.target.files);e.target.value=''}}/></label></div>
}

export function Modal({title,onClose,children,headerAction}:{title:string;onClose:()=>void;children:ReactNode;headerAction?:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 const nativeDialog=typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype.showModal==='function';
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null;const dialog=ref.current;if(dialog&&typeof dialog.showModal==='function')dialog.showModal();return ()=>{if(dialog&&typeof dialog.close==='function')dialog.close();prior?.focus()}},[]);
 return <dialog ref={ref} open={nativeDialog?undefined:true} onCancel={e=>{e.preventDefault();onClose()}} aria-labelledby="detail-title"><div className="dialog-head"><div className="dialog-title-group"><h2 id="detail-title">{title}</h2>{headerAction}</div><button onClick={onClose}>Закрыть ×</button></div>{children}</dialog>
}

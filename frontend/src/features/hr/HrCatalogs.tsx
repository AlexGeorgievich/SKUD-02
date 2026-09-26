import type {HrCatalogsData} from './hrTypes';

export function HrCatalogs({catalogs,onExport}:{catalogs:HrCatalogsData;onExport:()=>void}){
 const groups:[string,{id:string;name?:string;label?:string}[]][]=[['Офисы',catalogs.offices],['Отделы',catalogs.departments],['Юридические лица',catalogs.legal_entities],['Пол и форматы работы',catalogs.values]];
 return <section className="card hr-catalogs"><header><div><p className="eyebrow">СТРУКТУРА КУС</p><h2>Справочники кадрового учёта</h2><p>Эти значения используются при заполнении карточек и кадровом обмене Excel.</p></div><button onClick={onExport}>Выгрузить КУС в Excel</button></header><div className="hr-catalog-grid">{groups.map(([title,items])=><article key={title}><h3>{title}</h3>{items.length?<ul>{items.map(item=><li key={item.id}>{item.name||item.label}</li>)}</ul>:<p>Значения пока не заведены</p>}</article>)}</div></section>
}

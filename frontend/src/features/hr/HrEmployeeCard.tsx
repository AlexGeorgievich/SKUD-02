import type {HrCatalogsData,HrEmployee} from './hrTypes';
import {HrPersonalFields} from './HrPersonalFields';

export function HrEmployeeCard({catalogs,mode,draft,onChange}:{employee:HrEmployee;catalogs:HrCatalogsData;mode:'edit'|'read-only';draft:Record<string,string>;onChange:(key:string,value:string)=>void}){
 return <HrPersonalFields draft={draft} disabled={mode==='read-only'} catalogs={catalogs} onChange={onChange}/>;
}

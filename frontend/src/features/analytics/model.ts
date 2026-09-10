import type {Dataset,Employee} from '../../shared/types';
export function filterEmployees(data:Dataset|null,department:string,search:string){
 const q=search.trim().toLocaleLowerCase('ru');
 return (data?.employees||[]).filter(e=>(!department||e.department===department)&&(!q||e.name.toLocaleLowerCase('ru').includes(q)));
}
export function summarize(employees:Employee[]){
 const s=employees.reduce((s,e)=>({people:s.people+1,minutes:s.minutes+e.minutes,issues:s.issues+e.issues,office:s.office+e.office_elapsed,confirmed:s.confirmed+e.office_confirmed,registered:s.registered+e.registered}),{people:0,minutes:0,issues:0,office:0,confirmed:0,registered:0});
 return {...s,ratio:s.office?Math.round(100*s.confirmed/s.office):null};
}

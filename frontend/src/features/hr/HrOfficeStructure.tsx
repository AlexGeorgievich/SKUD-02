export function HrOfficeStructure({departments}:{departments:[string,number][]}){
 const employees=departments.reduce((sum,[,count])=>sum+count,0);
 return <section className="hr-office-summary" aria-label="Структура офиса"><div><span>Офис</span><b>PPL Group</b></div><div><span>Отделов</span><b>{departments.length}</b></div><div><span>Сотрудников</span><b>{employees}</b></div><div className="hr-department-chips">{departments.slice(0,6).map(([department,count])=><span key={department}>{department} <b>{count}</b></span>)}{departments.length>6&&<span>+{departments.length-6} отделов</span>}</div></section>;
}

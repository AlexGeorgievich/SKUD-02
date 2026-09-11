export function HrOfficeStructure({departments}:{departments:[string,number][]}){
 return <section className="card hr-office-structure" aria-label="Структура офиса"><h3>Структура офиса</h3><p>Офис → отдел → сотрудник</p><div className="hr-dept-list">{departments.map(([department,count])=><div key={department}><span>{department}</span><b>{count} сотрудников</b></div>)}</div></section>;
}

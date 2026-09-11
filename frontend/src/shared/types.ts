export type Role = 'admin'|'timekeeper'|'hr'|'manager'|'executive'|'employee'|'auditor';
export interface User {username:string; role:Role; role_label:string; department?:string; employee_id?:string}
export interface Employee {id:string; name:string; department:string; counts:Record<string,number>; minutes:number; registered:number; issues:number; office_elapsed:number; office_confirmed:number}
export interface Day {id:string; department:string; date:string; plan:string; raw:string; result:string; problem:boolean; arrival:string; departure:string; minutes:number|null; registered:boolean; issue:string}
export interface Dataset {period:string; asof:string; employees:Employee[]; days:Day[]; unmatched:{id:string; reason:string}[]}
export interface Preview {plan_count:number; fact_count:number; plan:PreviewRow[]; fact:PreviewRow[]}
export interface PreviewRow {name:string; department:string; values:(string|number|null)[]}
export const VIEWS = ['План','Факт','План-факт','Дашборд','За месяц','Проверка данных','По дням','Аналитика и KPI','Загрузка Excel','Журнал действий','Кадровый учёт','Администрирование'] as const;
export type View = typeof VIEWS[number];
export const CODES = ['О','Д','Отп','Б','От','Вых'];
export const STATUS_LABELS:Record<string,string>={О:'Офис',Д:'Дистанционно',Отп:'Отпуск',Б:'Больничный',От:'Отгул',Вых:'Выходной'};
export const STATUS_COLORS:Record<string,string>={О:'#3b82f6',Д:'#14b8a6',Отп:'#f59e0b',Б:'#ef4444',От:'#8b5cf6',Вых:'#94a3b8'};
export const WRITERS:Role[] = ['admin','timekeeper','hr'];

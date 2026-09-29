import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DataTable,FileDrop} from '../shared/ui';
import {Login} from '../features/auth/Login';
import {Upload} from '../features/import/Upload';
import {KusSourceReview} from '../features/import/KusSourceReview';
import {filterEmployees,summarize} from '../features/analytics/model';
import type {Dataset,Employee} from '../shared/types';
import {Workspace} from '../app/Workspace';
import {HrPage} from '../features/hr/HrPage';
import {AdminPage} from '../features/admin/AdminPage';

afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe('Файлы',()=>{
 it('принимает XLSX через drop',()=>{const onFile=vi.fn(),onError=vi.fn();render(<FileDrop title="План" file={null} onFile={onFile} onError={onError}/>);const file=new File(['xlsx'],'plan.xlsx');fireEvent.drop(screen.getByText('Перетащите Excel сюда').closest('label')!,{dataTransfer:{files:[file]}});expect(onFile).toHaveBeenCalledWith(file);expect(onError).not.toHaveBeenCalled()});
 it('отклоняет несколько файлов и чужой формат',()=>{const onFile=vi.fn(),onError=vi.fn();render(<FileDrop title="План" file={null} onFile={onFile} onError={onError}/>);const target=screen.getByLabelText('План');fireEvent.change(target,{target:{files:[new File(['a'],'one.csv')]}});expect(onFile).not.toHaveBeenCalled();expect(onError).toHaveBeenCalledWith('Поддерживаются только файлы .xlsx');fireEvent.change(target,{target:{files:[new File(['a'],'one.xlsx'),new File(['b'],'two.xlsx')]}});expect(onError).toHaveBeenCalledWith('Выберите один файл для этой области')});
 it('отправляет выбранную пару как multipart и блокирует повторное нажатие',async()=>{
  let resolve!:(r:Response)=>void;const fetchMock=vi.fn(()=>new Promise<Response>(r=>{resolve=r}));vi.stubGlobal('fetch',fetchMock);
  const complete=vi.fn(async()=>{});render(<Upload period="2026-08" onComplete={complete} notify={vi.fn()} canImport setImportBusy={vi.fn()}/>);
  const user=userEvent.setup();await user.upload(screen.getByLabelText('01 / План работ'),new File(['p'],'plan.xlsx'));await user.upload(screen.getByLabelText('02 / СКУД_факт'),new File(['f'],'fact.xlsx'));
  expect(screen.getByText(/Выбран файл: plan\.xlsx/)).toBeTruthy();expect(screen.getByText(/Выбран файл: fact\.xlsx/)).toBeTruthy();
  await user.click(screen.getByText('Обработать план–факт →'));expect((screen.getByText('Обработка…') as HTMLButtonElement).disabled).toBe(true);
  const options=fetchMock.mock.calls[0] as unknown as [string,RequestInit];const fd=options[1].body as FormData;
  expect(fd.get('period')).toBe('2026-08');expect((fd.get('plan') as File).name).toBe('plan.xlsx');expect((fd.get('fact') as File).name).toBe('fact.xlsx');
  resolve(new Response(JSON.stringify({employees:166,unmatched:0}),{status:200}));await waitFor(()=>expect(complete).toHaveBeenCalledOnce());
 });
});
describe('Расчёты интерфейса',()=>{
 const base:Employee={id:'1',name:'Иванов Иван',department:'HR',counts:{О:2},minutes:540,registered:1,issues:1,office_elapsed:2,office_confirmed:1};
 it('согласует фильтры отдела и поиска',()=>{const d={employees:[base,{...base,id:'2',name:'Петров Пётр',department:'Buying'}]} as Dataset;expect(filterEmployees(d,'HR',' ИВАНОВ ')).toEqual([base]);expect(filterEmployees(d,'Buying','Иванов')).toEqual([])});
 it('рассчитывает взвешенный KPI, а не среднее процентов',()=>{expect(summarize([base,{...base,office_elapsed:8,office_confirmed:8}]).ratio).toBe(90);expect(summarize([]).ratio).toBeNull()});
});
describe('Выбор строки таблицы',()=>{
 const rows=[
  {key:'1',person:'1',cells:['Иванов Иван','HR']},
  {key:'2',person:'2',cells:['Петров Пётр','Buying']},
  {key:'3',person:'3',cells:['Сидорова Анна','Finance']}
 ];
 it('выбирает строку щелчком, а карточку открывает только через ФИО',async()=>{
  const onPerson=vi.fn();render(<DataTable headers={['Сотрудник','Отдел']} rows={rows} onPerson={onPerson} selectable compact/>);
  const user=userEvent.setup(),first=screen.getByRole('row',{name:/Иванов Иван/});
  await user.click(first);expect(first.getAttribute('aria-selected')).toBe('true');expect(onPerson).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'Иванов Иван'}));expect(onPerson).toHaveBeenCalledWith('1');
 });
 it('перемещает выбор стрелками и снимает его по Escape',async()=>{
  render(<DataTable headers={['Сотрудник','Отдел']} rows={rows} selectable compact/>);const user=userEvent.setup();
  const first=screen.getByRole('row',{name:/Иванов Иван/}),second=screen.getByRole('row',{name:/Петров Пётр/});
  await user.click(first);await user.keyboard('{ArrowDown}');
  expect(first.getAttribute('aria-selected')).toBe('false');expect(second.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(second);
  await user.keyboard('{Escape}');expect(second.getAttribute('aria-selected')).toBe('false');
 });
 it('открывает детализацию выбранной строки по Enter',async()=>{
  const onPerson=vi.fn();render(<DataTable headers={['Сотрудник','Отдел']} rows={rows} onPerson={onPerson} selectable compact/>);const user=userEvent.setup();
  const first=screen.getByRole('row',{name:/Иванов Иван/});await user.click(first);await user.keyboard('{Enter}');expect(onPerson).toHaveBeenCalledWith('1');
 });
 it('прокручивает календарную таблицу стрелками влево и вправо',async()=>{
  render(<DataTable headers={['Сотрудник','Отдел','1']} rows={rows.map(row=>({...row,cells:[...row.cells,'О']}))} selectable calendar/>);const user=userEvent.setup();
  const wrap=document.querySelector('.calendar-table') as HTMLElement,first=screen.getByRole('row',{name:/Иванов Иван/});Object.defineProperty(wrap,'clientWidth',{value:300});Object.defineProperty(wrap,'scrollWidth',{value:900});
  await user.click(first);await user.keyboard('{ArrowRight}');expect(wrap.scrollLeft).toBeGreaterThan(0);await user.keyboard('{ArrowLeft}');expect(wrap.scrollLeft).toBe(0);
 });
});
it('показывает отказ входа без открытия рабочего пространства',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({detail:'Неверный логин или пароль'}),{status:401})));
 const login=vi.fn();render(<Login onLogin={login}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Пароль'),'bad-password');await user.click(screen.getByText('Войти в систему →'));await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toBe('Неверный логин или пароль');expect(login).not.toHaveBeenCalled();
});
describe('Сопоставление импорта с КУС',()=>{
 it('не разрешает apply до ручного выбора неизвестного ФИ и отправляет UUID',async()=>{
  const fetchMock=vi.fn(async(_url:RequestInfo|URL,options?:RequestInit)=>{
   if(options?.method==='POST'&&(options.body as FormData).has('decisions'))return new Response(JSON.stringify({status:'published',version:1}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify({rows:[{row_number:6,source_name:'Новый Иван',source_department:'Buying',candidate_ids:[],candidates:[{id:'kus-1',name:'Иван Новый',department:'Buying'}],status:'unknown'}],requires_review:1,errors:[]}),{status:200,headers:{'Content-Type':'application/json'}});
  });vi.stubGlobal('fetch',fetchMock);
  render(<KusSourceReview period="2026-08" kind="plan" file={new File(['plan'],'plan.xlsx')} notify={vi.fn()}/>);
  const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Preview'}));
  const apply=screen.getByRole('button',{name:'Применить в историю'}) as HTMLButtonElement;expect(apply.disabled).toBe(true);
  await user.selectOptions(screen.getByLabelText('Сопоставление строки 6'),'kus-1');expect(apply.disabled).toBe(false);
  await user.click(apply);await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
  const body=fetchMock.mock.calls[1][1]?.body as FormData;expect(body.get('decisions')).toBe('{"6":"kus-1"}');
 });
 it('запускает расчёт истории за дату среза и показывает сохранённую сводку',async()=>{
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({version:1,source_versions:{plan:2,fact:1},employees:[{employee_id:'kus-1',employee_name:'Иванов Иван',department:'Buying',minutes:540,registered_days:1,issues:2}],days:[],unmatched:[]}),{status:200,headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetchMock);
  render(<Upload period="2026-08" onComplete={vi.fn(async()=>{})} notify={vi.fn()} canImport setImportBusy={vi.fn()}/>);
  await userEvent.setup().click(screen.getByRole('button',{name:'Рассчитать месячный план–факт'}));
  await screen.findByText(/Расчёт версии 1/);
  expect(screen.getByText(/Иванов Иван/)).toBeTruthy();
  const [url,options]=fetchMock.mock.calls[0] as unknown as [string,RequestInit];expect(url).toContain('/api/uvr/periods/2026-08/calculate');expect(options.method).toBe('POST');
 });
});

describe('Кадровое рабочее место',()=>{
 const employee={id:'hr-1',plan_name:'Беляев Харлампий',plan_department:'Accounting Offline',office:null,department:'Accounting Offline',department_status:null,gender:null,birth_year:null,position:null,hire_date:null,work_schedule:null,employment_status:'active'};
 function renderHr(role:'admin'|'hr'|'timekeeper'='hr'){
  vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL)=>{
   const path=String(url);
   if(path.includes('/calendar'))return new Response(JSON.stringify({items:[{employee_id:'hr-1',employee_name:'Беляев Харлампий',department:'Accounting Offline',date:'2026-09-12',kind:'hire_anniversary'}]}),{status:200,headers:{'Content-Type':'application/json'}});
   if(path.includes('/analytics'))return new Response(JSON.stringify({total:1,incomplete_cards:1,departments_without_deputy:['Accounting Offline'],departments:['Accounting Offline']}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify({items:[employee],count:1}),{status:200,headers:{'Content-Type':'application/json'}});
  }));
  return render(<HrPage role={role} notify={vi.fn()}/>);
 }
 it('переключает разделы Сотрудники, Календарь и Отчёты в шапке кадрового учёта',async()=>{
  renderHr();await screen.findByText('Беляев Харлампий');
  expect(screen.getByRole('tab',{name:'Сотрудники'})).toBeTruthy();
  await userEvent.click(screen.getByRole('tab',{name:'Календарь и юбилеи'}));
  expect(await screen.findByRole('heading',{name:'Дни рождения и годовщины работы'})).toBeTruthy();
  expect(screen.getByText('12 сентября')).toBeTruthy();
  await userEvent.click(screen.getByRole('tab',{name:'Отчёты и аналитика'}));
  expect(await screen.findByRole('heading',{name:/Сводные отчёты по персоналу/})).toBeTruthy();
  expect(screen.getByText('Испыт. срок')).toBeTruthy();
 });
 it('показывает компактный реестр с поиском и кадровыми фильтрами',async()=>{
  renderHr();await screen.findByText('Беляев Харлампий');
  expect(screen.getByRole('heading',{name:'HR Персонал'})).toBeTruthy();
  expect(screen.getByLabelText('Поиск сотрудников')).toBeTruthy();
  expect(screen.getByLabelText('Фильтр по отделу')).toBeTruthy();
  expect(screen.getByLabelText('Фильтр по статусу')).toBeTruthy();
  expect(screen.getByText('Найдено: 1')).toBeTruthy();
  const metrics=document.querySelector('.hr-inline-metrics') as HTMLElement;
  expect(metrics.textContent).toContain('Офис');expect(metrics.textContent).not.toContain('Группы');
  const search=screen.getByLabelText('Поиск сотрудников'),add=screen.getByRole('button',{name:'Добавить сотрудника'});
  expect(search.compareDocumentPosition(add)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(document.querySelector('.hr-system-actions')?.contains(add)).toBe(false);
  expect(document.querySelector('.hr-search-row')?.contains(add)).toBe(true);
  expect(document.querySelector('.hr-department-summary')?.getAttribute('tabindex')).toBe('0');
 });
 it('применяет фильтр отдела по клику на названии отдела в сводке',async()=>{
  const second={...employee,id:'hr-2',plan_name:'Петров Пётр',department:'HR',plan_department:'HR'};
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({items:[employee,second],count:2}),{status:200,headers:{'Content-Type':'application/json'}})));
  render(<HrPage role="hr" notify={vi.fn()}/>);await screen.findByText('Петров Пётр');
  await userEvent.click(screen.getByRole('button',{name:/HR 1/}));
  expect((screen.getByLabelText('Фильтр по отделу') as HTMLSelectElement).value).toBe('HR');
  expect(screen.queryByRole('button',{name:'Беляев Харлампий'})).toBeNull();
 });
 it('выделяет ФИО в таблице отдельным увеличенным стилем',async()=>{
  renderHr();const person=await screen.findByRole('button',{name:'Беляев Харлампий'});
  expect(person.querySelector('.hr-person-name')).toBeTruthy();
 });
 it('открывает широкую карточку с вкладками и компактным фото',async()=>{
  renderHr();await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  const dialog=screen.getByRole('dialog',{name:/Карточка сотрудника/});
  expect(within(dialog).getByRole('tab',{name:'Личные данные'})).toBeTruthy();
  expect(within(dialog).getByRole('tab',{name:'Рабочие данные'})).toBeTruthy();
  expect(within(dialog).getByRole('tab',{name:'СКУД и доступ'})).toBeTruthy();
  expect(within(dialog).getByLabelText('Фото сотрудника')).toBeTruthy();
  expect(within(dialog).getByRole('button',{name:'Сохранить'})).toBeTruthy();
 });
 it('даёт выбрать полную дату рождения и окончания через календарь карточки',async()=>{
  renderHr();await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  const dialog=screen.getByRole('dialog',{name:/Карточка сотрудника/});
  expect(within(dialog).getByLabelText('Год рождения').getAttribute('type')).toBe('date');
  expect(within(dialog).getByLabelText('Год окончания').getAttribute('type')).toBe('date');
 });
 it('показывает поля личных данных в согласованном порядке и вычисляет ФИО без отчества',async()=>{
  renderHr();await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  const dialog=screen.getByRole('dialog',{name:/Карточка сотрудника/});
  const labels=[...dialog.querySelectorAll('.hr-form-panel label > span')].map(item=>item.textContent);
  expect(labels).toEqual(['Фамилия','Имя','Отчество','ФИО','Пол','Год рождения','Место рождения','Образование','Специальность','Год окончания','Учёная степень','ТГ','Личный телефон','Рабочая почта','Рекомендация','Рекрутер HR','Визитка','Стаж работы','Ссылка на фото','Картинка в почте','Страховка','Комментарии']);
  const fio=within(dialog).getByLabelText('ФИО') as HTMLInputElement;
  expect(fio.readOnly).toBe(true);
  await userEvent.clear(within(dialog).getByLabelText('Фамилия'));await userEvent.type(within(dialog).getByLabelText('Фамилия'),'Иванова');
  await userEvent.clear(within(dialog).getByLabelText('Имя'));await userEvent.type(within(dialog).getByLabelText('Имя'),'Анна');
  await userEvent.type(within(dialog).getByLabelText('Отчество'),'Петровна');
  expect(fio.value).toBe('Иванова Анна');
 });
 it('показывает рабочие поля в согласованном порядке и фильтрует отдел по офису',async()=>{
  const fetchMock=vi.fn(async(url:RequestInfo|URL)=>{
   if(String(url).includes('/catalogs'))return new Response(JSON.stringify({offices:[{id:'o1',name:'Москва'},{id:'o2',name:'СПб'}],departments:[{id:'d1',name:'Accounting Offline',office_id:'o1'},{id:'d2',name:'Buying',office_id:'o2'}],legal_entities:[{id:'l1',name:'ООО Тест'}],positions:[{id:'p1',kind:'position',label:'Аналитик'}],values:[{id:'g1',kind:'gender',label:'Женский'},{id:'g2',kind:'gender',label:'Мужской'},{id:'w1',kind:'work_format',label:'Гибкий'}]}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify({items:[{...employee,family_name:'Беляев',given_name:'Харлампий',office_id:'o1',department_id:'d1'}],count:1}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  vi.stubGlobal('fetch',fetchMock);render(<HrPage role="hr" notify={vi.fn()}/>);await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  const dialog=screen.getByRole('dialog',{name:/Карточка сотрудника/});await userEvent.click(within(dialog).getByRole('tab',{name:'Рабочие данные'}));
  const labels=[...dialog.querySelectorAll('.hr-form-panel label > span')].map(item=>item.textContent);
  expect(labels).toEqual(['Юридическое лицо','Офис','Отдел','Должность','Должность английская','Дата приёма','Испытательный срок','Формат работы','Руководитель отдела','Заместитель','Замещение с','Замещение по','Круг задач и направления']);
  expect(within(dialog).queryByRole('option',{name:'Buying'})).toBeNull();
  await userEvent.selectOptions(within(dialog).getByLabelText('Офис'),'o2');
  expect((within(dialog).getByLabelText('Отдел') as HTMLSelectElement).value).toBe('');
  expect(within(dialog).getByRole('option',{name:'Buying'})).toBeTruthy();
 });
 it('редактирует ФИО отдельными полями без раздела управления справочниками',async()=>{
  const fetchMock=vi.fn(async(url:RequestInfo|URL)=>{
   const path=String(url);
   if(path.includes('/catalogs'))return new Response(JSON.stringify({offices:[{id:'o1',name:'Главный офис'}],departments:[{id:'d1',name:'Accounting Offline',office_id:'o1'}],legal_entities:[{id:'l1',name:'ООО Тест'}],values:[{id:'g1',kind:'gender',label:'Женский'},{id:'w1',kind:'work_format',label:'Гибрид'}]}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify({items:[{...employee,family_name:'Беляев',given_name:'Харлампий',department_id:'d1',office_id:'o1'}],count:1}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  vi.stubGlobal('fetch',fetchMock);render(<HrPage role="hr" notify={vi.fn()}/>);await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  const dialog=screen.getByRole('dialog',{name:/Карточка сотрудника/});
  expect(within(dialog).getByLabelText('Фамилия')).toBeTruthy();
  expect(within(dialog).getByLabelText('Имя')).toBeTruthy();
  expect(within(dialog).getByLabelText('Отчество')).toBeTruthy();
  await userEvent.click(within(dialog).getByRole('button',{name:'Закрыть'}));
  expect(screen.queryByRole('tab',{name:'Справочники'})).toBeNull();
 });
 it('открывает карточку TimeTrack только для просмотра',async()=>{
  renderHr('timekeeper');await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  expect(screen.getByText(/Только просмотр/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Сохранить'})).toBeNull();
 });
 it('позволяет HR добавить сотрудника из реестра',async()=>{
  const created={...employee,id:'hr-2',plan_name:'Петров Пётр',department:'HR',plan_department:'HR'};
  vi.stubGlobal('fetch',vi.fn(async(_url,options)=>new Response(JSON.stringify(options?.method==='POST'?created:{items:[employee],count:1}),{status:options?.method==='POST'?201:200,headers:{'Content-Type':'application/json'}})));
  render(<HrPage role="hr" notify={vi.fn()}/>);await screen.findByText('Беляев Харлампий');
  await userEvent.click(screen.getByRole('button',{name:'Добавить сотрудника'}));
  const dialog=screen.getByRole('dialog',{name:'Новая карточка сотрудника'});
  expect(within(dialog).getByRole('tab',{name:'Личные данные'})).toBeTruthy();
  await userEvent.type(within(dialog).getByLabelText('Фамилия'),'Петров');
  await userEvent.type(within(dialog).getByLabelText('Имя'),'Пётр');
  await userEvent.click(within(dialog).getByRole('tab',{name:'Рабочие данные'}));
  await userEvent.selectOptions(within(dialog).getByLabelText('Отдел'),'Accounting Offline');
  await userEvent.click(within(dialog).getByRole('button',{name:'Сохранить'}));
  expect(await screen.findByRole('button',{name:'Петров Пётр'})).toBeTruthy();
 });
 it('закрывает новую карточку сотрудника по Escape без сохранения',async()=>{
  renderHr();await screen.findByText('Беляев Харлампий');
  await userEvent.click(screen.getByRole('button',{name:'Добавить сотрудника'}));
  expect(screen.getByRole('dialog',{name:'Новая карточка сотрудника'})).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog',{name:'Новая карточка сотрудника'})).toBeNull();
 });
 it('архивирует карточку только после отдельного подтверждения',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url,options)=>new Response(JSON.stringify(options?.method==='POST'?{...employee,archived_at:'2026-09-11T00:00:00Z'}:{items:[employee],count:1}),{status:200,headers:{'Content-Type':'application/json'}})));
  render(<HrPage role="hr" notify={vi.fn()}/>);await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  await userEvent.click(screen.getByRole('button',{name:'В архив'}));
  expect(screen.getByText(/Карточка исчезнет из активного реестра/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Подтвердить архивирование'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Беляев Харлампий'})).toBeNull());
 });
 it('показывает архивные карточки и восстанавливает сотрудника',async()=>{
  const archived={...employee,archived_at:'2026-09-11T00:00:00Z',archived_by:'hr'};
  const fetchMock=vi.fn(async(url:RequestInfo|URL,options?:RequestInit)=>{
   const path=String(url);
   if(path.includes('/restore'))return new Response(JSON.stringify({...employee,archived_at:null}),{status:200,headers:{'Content-Type':'application/json'}});
   if(path.includes('archived=true'))return new Response(JSON.stringify({items:[archived],count:1}),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify({items:[employee],count:1}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  vi.stubGlobal('fetch',fetchMock);render(<HrPage role="hr" notify={vi.fn()}/>);await screen.findByText('Беляев Харлампий');
  await userEvent.selectOptions(screen.getByLabelText('Режим реестра'),'archive');
  await userEvent.click(await screen.findByRole('button',{name:'Беляев Харлампий'}));
  expect(screen.getByText('Карточка в архиве')).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Восстановить'}));
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/restore'),expect.objectContaining({method:'POST'})));
 });
});

describe('Административные справочники',()=>{
 it('показывает четыре справочника, CRUD и сохраняет строку при конфликте удаления',async()=>{
  let positionName='Аналитик',deleteConflict=true;
  const catalogBody=()=>({
   legal_entities:[{id:'l1',name:'ООО Тест',employee_count:0}],
   offices:[{id:'o1',name:'Москва',employee_count:0,department_count:1}],
   departments:[{id:'d1',name:'Buying',office_id:'o1',head_id:'e1',employee_count:1,head_count:1}],
   positions:[{id:'p1',name:positionName,employee_count:1}],
  });
  const fetchMock=vi.fn(async(url:RequestInfo|URL,options?:RequestInit)=>{
   const path=String(url),method=options?.method||'GET';
   if(path.endsWith('/api/admin/users'))return new Response(JSON.stringify({items:[]}),{status:200,headers:{'Content-Type':'application/json'}});
   if(path.endsWith('/api/admin/catalogs')&&method==='GET')return new Response(JSON.stringify(catalogBody()),{status:200,headers:{'Content-Type':'application/json'}});
   if(path.endsWith('/api/hr/employees'))return new Response(JSON.stringify({items:[{id:'e1',plan_name:'Иванов Иван',department_id:'d1'}]}),{status:200,headers:{'Content-Type':'application/json'}});
   if(path.endsWith('/api/admin/catalogs/positions/p1')&&method==='PATCH'){positionName=JSON.parse(String(options?.body)).name;return new Response(JSON.stringify({...catalogBody().positions[0],name:positionName}),{status:200,headers:{'Content-Type':'application/json'}})}
   if(path.endsWith('/api/admin/catalogs/positions/p1')&&method==='DELETE'&&deleteConflict)return new Response(JSON.stringify({detail:'Удаление запрещено: существуют зависимости'}),{status:409,headers:{'Content-Type':'application/json'}});
   if(method==='POST')return new Response(JSON.stringify({id:'new',name:JSON.parse(String(options?.body)).name,employee_count:0}),{status:201,headers:{'Content-Type':'application/json'}});
   return new Response(null,{status:204});
  });
  vi.stubGlobal('fetch',fetchMock);const notify=vi.fn(),user=userEvent.setup();render(<AdminPage notify={notify}/>);
  await user.click(screen.getByRole('tab',{name:'Справочники'}));
  expect(await screen.findByRole('heading',{name:'Справочники кадрового учёта'})).toBeTruthy();
  for(const title of ['Юридические лица','Офисы','Отделы','Должности'])expect(screen.getByRole('heading',{name:title})).toBeTruthy();
  expect(screen.getByText(/Отделов: 1/)).toBeTruthy();expect(screen.getAllByText(/Сотрудников: 1/).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button',{name:'Добавить должность'}));await user.type(screen.getByLabelText('Название'),'Менеджер');await user.click(screen.getByRole('button',{name:'Сохранить'}));
  await user.click(screen.getByRole('button',{name:'Редактировать Аналитик'}));await user.clear(screen.getByLabelText('Название'));await user.type(screen.getByLabelText('Название'),'Старший аналитик');await user.click(screen.getByRole('button',{name:'Сохранить'}));
  expect(await screen.findByText('Старший аналитик')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Удалить Старший аналитик'}));expect(screen.getByText(/Подтвердите удаление/)).toBeTruthy();await user.click(screen.getByRole('button',{name:'Подтвердить удаление'}));
  expect((await screen.findByRole('alert')).textContent).toBe('Удаление запрещено: существуют зависимости');expect(screen.getByText('Старший аналитик')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Редактировать Buying'}));expect(screen.getByLabelText('Офис')).toBeTruthy();expect(screen.getByLabelText('Руководитель отдела')).toBeTruthy();
 });
});

const workspaceData:Dataset={
 period:'2026-08',asof:'2026-08-31',unmatched:[],days:[
  {id:'1',department:'HR',date:'2026-08-01',plan:'О',raw:'09:00\n18:00',result:'Без замечаний',problem:false,arrival:'09:00',departure:'18:00',minutes:540,registered:true,issue:''},
  {id:'1',department:'HR',date:'2026-08-02',plan:'О',raw:'',result:'Нет регистрации',problem:true,arrival:'',departure:'',minutes:null,registered:false,issue:'Нет регистрации'},
  {id:'2',department:'Buying',date:'2026-08-01',plan:'О',raw:'09:00\n17:00',result:'Без замечаний',problem:false,arrival:'09:00',departure:'17:00',minutes:480,registered:true,issue:''},
  {id:'2',department:'Buying',date:'2026-08-02',plan:'О',raw:'09:00\n17:00',result:'Без замечаний',problem:false,arrival:'09:00',departure:'17:00',minutes:480,registered:true,issue:''}
 ],
 employees:[
  {id:'1',name:'Иванов Иван',department:'HR',counts:{О:2},minutes:540,registered:1,issues:1,office_elapsed:2,office_confirmed:1},
  {id:'2',name:'Петров Пётр',department:'Buying',counts:{О:2},minutes:960,registered:2,issues:0,office_elapsed:2,office_confirmed:2}
 ]
};
function renderWorkspace(dataset:Dataset=workspaceData){
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(dataset),{status:200,headers:{'Content-Type':'application/json'}})));
 return render(<Workspace user={{username:'admin',role:'admin',role_label:'Системный администратор'}} onLogout={vi.fn()}/>);
}
describe('Рабочее пространство',()=>{
 it('показывает кадровый учёт первым модулем и скрывает администрирование от HR',async()=>{
  render(<Workspace user={{username:'hr',role:'hr',role_label:'HR-служба'}} onLogout={vi.fn()}/>);
  expect(screen.getAllByRole('group').map(group=>group.getAttribute('aria-label'))).toEqual(['Кадровый учёт','Учёт рабочего времени']);
  expect(screen.queryByRole('button',{name:'Администрирование'})).toBeNull();
 });
 it('показывает администрирование только системному администратору',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  expect(screen.getByRole('button',{name:'Администрирование'})).toBeTruthy();
 });
 it('показывает три верхних пункта общего GUI для admin',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  expect(screen.getAllByRole('group').map(group=>group.getAttribute('aria-label'))).toEqual(['Кадровый учёт','Учёт рабочего времени','Администрирование']);
 });
 it('не дублирует шапку TimeTrack внутри кадрового модуля',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({items:[],count:0}),{status:200,headers:{'Content-Type':'application/json'}})));
  await userEvent.click(screen.getByRole('button',{name:'Кадровый учёт'}));
  expect(screen.getByRole('heading',{name:'HR Персонал'})).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'Кадровый учёт'})).toBeNull();
  expect(screen.queryByLabelText('Дата-Месяц')).toBeNull();
 });
 it('использует структуру Офис — Отдел — Сотрудник и показывает весь список отделов',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');expect(screen.getByLabelText('Отдел')).toBeTruthy();expect(screen.getByRole('option',{name:'Все отделы'})).toBeTruthy();await userEvent.click(screen.getByRole('button',{name:'Дашборд'}));
  const legend=document.querySelector('.office-legend') as HTMLElement;expect(legend.className).toContain('office-legend-fit');expect(legend.style.gridAutoRows).toBeTruthy();expect(legend.querySelectorAll('.department-link')).toHaveLength(2);
 });
 it('группирует меню в кадровый модуль и учёт рабочего времени',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  const hr=screen.getByRole('group',{name:'Кадровый учёт'}),timetrack=screen.getByRole('group',{name:'Учёт рабочего времени'});
  expect(within(hr).getAllByRole('button').map(x=>x.textContent)).toEqual(['Кадровый учёт']);
  expect(within(timetrack).getByText('сводные данные')).toBeTruthy();
  expect(within(timetrack).getAllByRole('button').map(x=>x.textContent)).toContain('Дашборд');
  expect(within(timetrack).getAllByRole('button').map(x=>x.textContent)).toContain('Загрузка Excel');
 });
 it('переходит из аналитики в списочный состав выбранного отдела',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  const officeCard=screen.getByRole('heading',{name:'Подтверждение офисных дней по отделам'}).closest('.collapsible-panel') as HTMLElement;
  await userEvent.click(within(officeCard).getByRole('button',{name:'HR'}));
  expect(screen.getByRole('heading',{name:'За месяц'})).toBeTruthy();
  expect((screen.getByLabelText('Отдел') as HTMLSelectElement).value).toBe('HR');
  expect(screen.getByText('Иванов Иван')).toBeTruthy();
  expect(screen.queryByText('Петров Пётр')).toBeNull();
 });
 it('фильтрует KPI по дате и статусу плана и показывает итоги по офису',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  expect(screen.getByLabelText('Дата аналитики')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Дата аналитики'),{target:{value:'2026-08-02'}});
  await userEvent.selectOptions(screen.getByLabelText('Статус плана'),'О');
  expect(screen.getByRole('heading',{name:'Итого по офису'})).toBeTruthy();
  expect(screen.getAllByText('О — Офис').length).toBeGreaterThan(0);
  expect(screen.getAllByText('2 сотрудника').length).toBeGreaterThan(0);
  expect(screen.getByRole('heading',{name:'Все отделы'})).toBeTruthy();
 });
 it('сохраняет итоги офиса и показывает сводку выбранного отдела ниже',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  const daily=screen.getByTestId('daily-analytics');await userEvent.click(within(daily).getByRole('button',{name:'Все отделы'}));await userEvent.click(within(daily).getByRole('button',{name:'HR'}));
  expect(within(daily).getByRole('heading',{name:'Итого по офису'})).toBeTruthy();expect(within(daily).getByRole('heading',{name:'Отдел: HR'})).toBeTruthy();expect(within(daily).getByText('Иванов Иван')).toBeTruthy();expect(within(daily).queryByText('Петров Пётр')).toBeNull();
 });
 it('делает строки сводки по дате компактными',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  const daily=screen.getByTestId('daily-analytics');await userEvent.click(within(daily).getByRole('button',{name:'Все отделы'}));await userEvent.click(within(daily).getByRole('button',{name:'HR'}));
  expect(daily.querySelector('.compact-table')).toBeTruthy();expect(daily.querySelector('.daily-fact')).toBeTruthy();
 });
 it('проваливается из сводки по дате в отдел и сотрудника с откатом по Escape',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  const daily=screen.getByTestId('daily-analytics');await userEvent.click(within(daily).getByRole('button',{name:'Все отделы'}));await userEvent.click(within(daily).getByRole('button',{name:'HR'}));
  expect(within(daily).getByRole('heading',{name:'Отдел: HR'})).toBeTruthy();expect(within(daily).queryByRole('button',{name:'Buying'})).toBeNull();
  await userEvent.click(within(daily).getByRole('button',{name:'Иванов Иван'}));expect(screen.getByRole('dialog',{name:/Проверка данных — Иванов Иван/})).toBeTruthy();
  await userEvent.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(within(daily).getByRole('heading',{name:'Отдел: HR'})).toBeTruthy();await userEvent.keyboard('{Escape}');expect(within(daily).getByRole('heading',{name:'Все отделы'})).toBeTruthy();
 });
 it('сворачивает таблицы KPI и раскрывает их по строке заголовка',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  const daily=screen.getByTestId('daily-analytics');expect(daily.querySelectorAll('table')).toHaveLength(0);
  const allHeading=within(daily).getByRole('heading',{name:'Все отделы'});await userEvent.click(allHeading);expect(daily.querySelectorAll('table')).toHaveLength(1);
  await userEvent.click(allHeading);expect(daily.querySelectorAll('table')).toHaveLength(0);
 });
 it('сворачивает подтверждение офисных дней в выпадающий блок',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Аналитика и KPI'}));
  const heading=screen.getByRole('heading',{name:'Подтверждение офисных дней по отделам'});const panel=heading.closest('.collapsible-panel')!;
  const toggle=panel.querySelector('button.collapse-head')!;expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(panel.querySelector('.bars')).toBeTruthy();
 });
 it('показывает подписи фильтров в компактной шапке',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  expect(screen.getByText('Отдел —',{selector:'span'})).toBeTruthy();
  expect(screen.getByText('Дата-Месяц —',{selector:'span'})).toBeTruthy();
 });
 it('закрепляет шапку рабочего пространства при прокрутке',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  expect(document.querySelector('#workspace header')).toBeTruthy();
 });
 it('не дублирует текстовую легенду над месячной таблицей',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await userEvent.click(screen.getByRole('button',{name:'За месяц'}));
  expect(screen.queryByText('О — офис · Д — дистанционная работа · Отп — отпуск · Б — больничный · От — отгул · Вых — выходной')).toBeNull();
 });
 it('показывает день недели и выделяет выходные колонки в календарных таблицах',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'План'}));
  const firstDay=screen.getByRole('columnheader',{name:'1 сб'}),thirdDay=screen.getByRole('columnheader',{name:'3 пн'});expect(firstDay.className).toContain('calendar-nonworking');expect(thirdDay.className).not.toContain('calendar-nonworking');expect(screen.getByRole('columnheader',{name:'Сотрудник'}).className).toContain('calendar-frozen');expect(screen.getByRole('columnheader',{name:'Отдел'}).className).toContain('calendar-frozen');
 });
 it('выделяет будний день как праздничный при общем статусе Вых',async()=>{
  const holidayData:Dataset={...workspaceData,days:[...workspaceData.days,{...workspaceData.days[0],date:'2026-08-03',plan:'Вых',raw:'',registered:false},{...workspaceData.days[2],date:'2026-08-03',plan:'Вых',raw:'',registered:false}]};renderWorkspace(holidayData);await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'План'}));
  expect(screen.getByRole('columnheader',{name:'3 пн'}).className).toContain('calendar-holiday');
 });
 it('применяет палитру статусов во всех рабочих таблицах',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  for(const view of ['За месяц','План','Проверка данных','По дням']){
   await userEvent.click(screen.getByRole('button',{name:view}));
   expect(document.querySelector('.status-0')).toBeTruthy();
   expect(screen.getByRole('region',{name:'Структура плана'})).toBeTruthy();
  }
 });
 it('разделяет план и факт СКУД на выровненные подстроки сотрудника',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'План-факт'}));
 const headers=screen.getAllByRole('columnheader').slice(0,3).map(cell=>cell.textContent);expect(headers).toEqual(['Сотрудник','Отдел','Источник']);
  expect(screen.getAllByRole('columnheader').slice(0,3).every(cell=>cell.className.includes('calendar-frozen'))).toBe(true);const calendarNav=document.querySelector('.calendar-navigation') as HTMLElement;expect(calendarNav).toBeTruthy();const next=within(calendarNav).getByRole('button',{name:'Далее'});expect(next).toBeTruthy();await userEvent.click(next);expect(document.querySelector('.calendar-table')?.getAttribute('data-calendar-start')).toBe('5');expect((within(calendarNav).getByRole('button',{name:'Назад'}) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('region',{name:'Структура плана'}).textContent).toContain('О — Офис');
  expect(screen.getByRole('region',{name:'Структура плана'}).textContent).toContain('От — Отгул');
  const row=screen.getByRole('row',{name:/Иванов Иван/});expect(within(row).getByText('план')).toBeTruthy();expect(within(row).getByText('факт')).toBeTruthy();
  expect(within(row).getByLabelText('План на 1').textContent).toBe('О');expect(within(row).getByLabelText('Факт СКУД за 1').textContent).toContain('09:00');
  expect(within(row).getByLabelText('Факт СКУД за 2').textContent).toContain('Требует проверки');
 });
 it('готовит альбомную печать широкой таблицы от левого края',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'План-факт'}));
  const printSpy=vi.spyOn(window,'print').mockImplementation(()=>{const style=document.getElementById('print-layout-style');expect(style?.textContent).toContain('landscape');expect(document.body.dataset.printLayout).toBe('wide')});
  await userEvent.click(screen.getByRole('button',{name:'Печать'}));expect(printSpy).toHaveBeenCalledOnce();printSpy.mockRestore();
 });
 it('строит BI-графики по всем отделам из подневных данных',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await userEvent.click(screen.getByRole('button',{name:'Дашборд'}));
  expect(screen.getByRole('heading',{name:'BI-дашборд · Все отделы'})).toBeTruthy();
  expect(screen.getByText('Сотрудников').closest('.card')?.className).toContain('bi-kpi-card');
  expect(screen.getByRole('img',{name:'Динамика по дням'})).toBeTruthy();
  expect(screen.getByRole('region',{name:'Карта замечаний'})).toBeTruthy();
  expect(screen.getByLabelText('01.08: план О — 2; регистрации — 2')).toBeTruthy();
 expect(screen.getByText('Подтверждение офисных дней по отделам')).toBeTruthy();
 });
 it('раскрывает по ячейке карты замечаний исходные записи отдела и закрывает их по Escape',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Дашборд'}));
  expect(screen.getByRole('region',{name:'Карта замечаний'}).closest('.heatmap-card')?.className).toContain('heatmap-card-wide');
  await user.click(screen.getByRole('button',{name:'HR, 2026-08-02: замечаний 1'}));
  expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByRole('heading',{name:'Расшифровка замечаний · HR · 02.08.2026'})).toBeTruthy();
  const detail=screen.getByRole('dialog');
  expect(within(detail).getByText('Иванов Иван')).toBeTruthy();expect(within(detail).getByText('Нет регистрации')).toBeTruthy();
  await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('показывает структуру офиса круговой диаграммой и компактную динамику ниже',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Дашборд'}));
  expect(screen.getByRole('img',{name:'Treemap структуры офиса по штату'})).toBeTruthy();
  const dashboard=screen.getByRole('heading',{name:'BI-дашборд · Все отделы'}).closest('.bi-dashboard')!;
  expect(dashboard.querySelector('.office-structure')).toBeTruthy();expect(dashboard.querySelector('.daily-chart')).toBeTruthy();
 });
 it('полностью заполняет treemap пропорциональными плитками и сохраняет список слева',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');await userEvent.click(screen.getByRole('button',{name:'Дашборд'}));
  expect(screen.getByRole('option',{name:'Все отделы'})).toBeTruthy();const surface=screen.getByRole('img',{name:'Treemap структуры офиса по штату'});const legend=document.querySelector('.office-legend') as HTMLElement;expect(within(legend).getByRole('button',{name:/HR/})).toBeTruthy();expect(surface.classList.contains('office-treemap-surface')).toBe(true);const tiles=[...surface.querySelectorAll<HTMLElement>('.office-tile')];expect(tiles.length).toBeGreaterThan(0);expect(tiles.every(tile=>tile.style.position==='absolute'&&tile.style.width.endsWith('%')&&tile.style.height.endsWith('%'))).toBe(true);expect(tiles.reduce((sum,tile)=>sum+Number(tile.dataset.share),0)).toBeCloseTo(100,5);expect(document.querySelector('.react-grid-layout')).toBeNull();
 });
 it('перестраивает BI-графики по выбранному отделу и открывает сотрудника',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await userEvent.selectOptions(screen.getByLabelText('Отдел'),'HR');
  await userEvent.click(screen.getByRole('button',{name:'Дашборд'}));
  expect(screen.getByRole('heading',{name:'BI-дашборд · HR'})).toBeTruthy();
  expect(screen.getByRole('img',{name:'Treemap структуры плана: HR'})).toBeTruthy();
  const planLegend=document.querySelector('.plan-treemap-legend') as HTMLElement;expect(planLegend).toBeTruthy();expect(planLegend.querySelectorAll(':scope > div')).toHaveLength(6);expect(within(planLegend).getByText('О — Офис')).toBeTruthy();expect(within(planLegend).getByText('Д — Дистанционно')).toBeTruthy();
  expect(screen.getByText('Рейтинг сотрудников по замечаниям')).toBeTruthy();
  expect(screen.getByText('Распределение часов присутствия')).toBeTruthy();
  expect(screen.getByLabelText('02.08: план О — 1; регистрации — 0')).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Иванов Иван'}));
  expect(screen.getByRole('dialog')).toBeTruthy();
 });
 it('открывает из информационного окна кадровую карточку только для просмотра и возвращается по уровням Escape',async()=>{
  const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.includes('/api/hr/employees/1/read-only'))return new Response(JSON.stringify({
    id:'hr-1',plan_employee_id:'1',plan_name:'Иванов Иван',plan_department:'HR',office:'PPL Group',department:'HR',
    position:'HR-специалист',department_status:'Сотрудник',gender:'Мужской',birth_year:1990,hire_date:'2024-02-01',
    work_schedule:'5/2, 09:00–18:00',employment_status:'active',personnel_number:'001',work_email:'ivanov@example.test',
    work_phone:'+7 000 000-00-00',access_card_number:'CARD-1',access_card_status:'Активна',access_level:'Офис',mode:'read-only'
   }),{status:200,headers:{'Content-Type':'application/json'}});
   return new Response(JSON.stringify(workspaceData),{status:200,headers:{'Content-Type':'application/json'}});
  });
  vi.stubGlobal('fetch',fetchMock);const user=userEvent.setup();
  render(<Workspace user={{username:'timekeeper',role:'timekeeper',role_label:'Специалист УВР'}} onLogout={vi.fn()}/>);
  await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await user.click(screen.getByRole('button',{name:'План'}));
  const tableName=screen.getByRole('button',{name:'Иванов Иван'});await user.click(tableName);
  const detail=screen.getByRole('dialog',{name:/Проверка данных — Иванов Иван/});
  const cardLink=within(detail).getByRole('button',{name:'Открыть кадровую карточку Иванов Иван'});await user.click(cardLink);
  const card=await screen.findByRole('dialog',{name:'Кадровая карточка сотрудника Иванов Иван'});
  expect(within(card).getByText('Только просмотр')).toBeTruthy();
  await user.click(within(card).getByRole('tab',{name:'Рабочие данные'}));
  expect(within(card).getByText('HR-специалист')).toBeTruthy();
  expect(within(card).queryByRole('button',{name:/Сохранить|Удалить|В архив/})).toBeNull();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog',{name:'Кадровая карточка сотрудника Иванов Иван'})).toBeNull();
  expect(screen.getByRole('dialog',{name:/Проверка данных — Иванов Иван/})).toBeTruthy();
  expect(document.activeElement).toBe(cardLink);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(tableName);
 });
 it('возвращается по уровням дашборда клавишей Escape',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Дашборд'}));await user.click(screen.getAllByRole('button',{name:'HR'})[0]);
  expect(screen.getByRole('heading',{name:'BI-дашборд · HR'})).toBeTruthy();expect(screen.getByText('Esc — Все отделы')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Иванов Иван'}));expect(screen.getByRole('dialog')).toBeTruthy();
  await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('heading',{name:'BI-дашборд · HR'})).toBeTruthy();
  await user.keyboard('{Escape}');expect(screen.getByRole('heading',{name:'BI-дашборд · Все отделы'})).toBeTruthy();expect((screen.getByLabelText('Отдел') as HTMLSelectElement).value).toBe('');
 });
});

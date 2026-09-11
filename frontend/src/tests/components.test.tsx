import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DataTable,FileDrop} from '../shared/ui';
import {Login} from '../features/auth/Login';
import {Upload} from '../features/import/Upload';
import {filterEmployees,summarize} from '../features/analytics/model';
import type {Dataset,Employee} from '../shared/types';
import {Workspace} from '../app/Workspace';

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
 it('использует структуру Офис — Отдел — Сотрудник и показывает весь список отделов',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');expect(screen.getByLabelText('Отдел')).toBeTruthy();expect(screen.getByRole('option',{name:'Все отделы'})).toBeTruthy();await userEvent.click(screen.getByRole('button',{name:'Дашборд'}));
  const legend=document.querySelector('.office-legend') as HTMLElement;expect(legend.className).toContain('office-legend-fit');expect(legend.style.gridAutoRows).toBeTruthy();expect(legend.querySelectorAll('.department-link')).toHaveLength(2);
 });
 it('группирует меню в три визуальных блока с дашбордом в аналитике',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  const primary=screen.getByRole('group',{name:'План и факт'}),analytics=screen.getByRole('group',{name:'Аналитика'}),service=screen.getByRole('group',{name:'Служебные разделы'});
  expect(within(primary).getAllByRole('button').map(x=>x.textContent)).toEqual(['План','Факт','План-факт']);
  expect(within(primary).getByText('сводные данные')).toBeTruthy();
  expect(within(analytics).getAllByRole('button').map(x=>x.textContent)).toEqual(['Дашборд','За месяц','Проверка данных','По дням','Аналитика и KPI']);
  expect(within(service).getAllByRole('button').map(x=>x.textContent)).toEqual(['Загрузка Excel','Журнал действий','Кадровый учёт']);
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
  await userEvent.click(within(daily).getByRole('button',{name:'Иванов Иван'}));expect(within(daily).getByRole('heading',{name:'Сотрудник: Иванов Иван'})).toBeTruthy();
  await userEvent.keyboard('{Escape}');expect(within(daily).getByRole('heading',{name:'Отдел: HR'})).toBeTruthy();await userEvent.keyboard('{Escape}');expect(within(daily).getByRole('heading',{name:'Все отделы'})).toBeTruthy();
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
 it('расшифровывает коды над месячной таблицей',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');
  await userEvent.click(screen.getByRole('button',{name:'За месяц'}));
  expect(screen.getByText('О — офис · Д — дистанционная работа · Отп — отпуск · Б — больничный · От — отгул · Вых — выходной')).toBeTruthy();
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
 it('возвращается по уровням дашборда клавишей Escape',async()=>{
  renderWorkspace();await screen.findByText('Загруженный период: 2026-08 · Дата анализа: 2026-08-31');const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Дашборд'}));await user.click(screen.getAllByRole('button',{name:'HR'})[0]);
  expect(screen.getByRole('heading',{name:'BI-дашборд · HR'})).toBeTruthy();expect(screen.getByText('Esc — Все отделы')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Иванов Иван'}));expect(screen.getByRole('dialog')).toBeTruthy();
  await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('heading',{name:'BI-дашборд · HR'})).toBeTruthy();
  await user.keyboard('{Escape}');expect(screen.getByRole('heading',{name:'BI-дашборд · Все отделы'})).toBeTruthy();expect((screen.getByLabelText('Отдел') as HTMLSelectElement).value).toBe('');
 });
});

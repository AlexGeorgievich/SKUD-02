import {useEffect, useMemo, useState} from 'react';

import {api, ApiError, errorText} from '../../shared/api/client';
import type {Role} from '../../shared/types';
import {HrOfficeStructure} from './HrOfficeStructure';

type Employee = {
  id: string;
  plan_name: string;
  plan_department: string;
  office?: string | null;
  department?: string | null;
  department_status?: string | null;
  gender?: string | null;
  birth_year?: number | null;
  position?: string | null;
  hire_date?: string | null;
  work_schedule?: string | null;
  department_head_id?: string | null;
  deputy_id?: string | null;
  deputy_from?: string | null;
  deputy_until?: string | null;
  employment_status?: string | null;
};

const EDITORS: Role[] = ['admin', 'hr'];
const EMPTY = 'Не заполнено';
const DEPARTMENT_STATUSES = ['Сотрудник', 'Руководитель отдела', 'Заместитель руководителя', 'Временно исполняющий обязанности'];

function cardDraft(employee: Employee) {
  return {
    office: employee.office || '', department: employee.department || employee.plan_department,
    department_status: employee.department_status || 'Сотрудник', gender: employee.gender || 'Не указан',
    birth_year: employee.birth_year ? String(employee.birth_year) : '', hire_date: employee.hire_date || '',
    work_schedule: employee.work_schedule || '', position: employee.position || '',
    department_head_id: employee.department_head_id || '', deputy_id: employee.deputy_id || '',
    deputy_from: employee.deputy_from || '', deputy_until: employee.deputy_until || '',
    employment_status: employee.employment_status || 'active',
  };
}

export function HrPage({role, notify}: {role: Role; notify: (message: string) => void}) {
  const [items, setItems] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api<{items: Employee[]}>('/api/hr/employees')
      .then((response) => setItems(response.items))
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 503)) notify(errorText(error));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const filtered = useMemo(() => items.filter((employee) =>
    `${employee.plan_name} ${employee.department || employee.plan_department} ${employee.position || ''}`
      .toLowerCase().includes(query.toLowerCase())), [items, query]);
  const departments = useMemo(() => Object.entries(items.reduce<Record<string, number>>((result, employee) => {
    const department = employee.department || employee.plan_department;
    result[department] = (result[department] || 0) + 1;
    return result;
  }, {})).sort((left, right) => right[1] - left[1]) as [string, number][], [items]);

  const openCard = (employee: Employee) => {
    setSelected(employee);
    setDraft(cardDraft(employee));
  };
  const saveCard = async () => {
    if (!selected || !EDITORS.includes(role)) return;
    const payload = {...draft, birth_year: draft.birth_year ? Number(draft.birth_year) : null};
    setSaving(true);
    try {
      const updated = await api<Employee>(`/api/hr/employees/${selected.id}`, {
        method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
      });
      setItems((current) => current.map((employee) => employee.id === updated.id ? updated : employee));
      setSelected(updated);
      setDraft(cardDraft(updated));
      notify('Карточка сотрудника сохранена');
    } catch (error) {
      notify(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  return <section className="card hr-page">
    <div className="pagehead">
      <div>
        <p className="eyebrow">КАДРОВЫЙ УЧЁТ</p>
        <h2>Реестр сотрудников</h2>
        <p>Первичный источник ФИО и отдела — «План».</p>
      </div>
      <button onClick={load}>Обновить</button>
    </div>
    <HrOfficeStructure departments={departments}/>
    <div className="toolbar">
      <input aria-label="Поиск в кадровом реестре" placeholder="Поиск по ФИО, отделу, должности" value={query} onChange={(event) => setQuery(event.target.value)}/>
      <small>{filtered.length} записей</small>
    </div>
    {loading ? <p role="status">Загрузка кадрового реестра…</p> : <div className="table-scroll"><table>
      <thead><tr><th>Фамилия Имя</th><th>Офис</th><th>Отдел</th><th>Должность</th><th>Статус в отделе</th></tr></thead>
      <tbody>{filtered.map((employee) => <tr key={employee.id}>
        <td><button className="link-button" onClick={() => openCard(employee)}>{employee.plan_name}</button></td>
        <td>{employee.office || EMPTY}</td>
        <td>{employee.department || employee.plan_department}</td>
        <td>{employee.position || EMPTY}</td>
        <td>{employee.department_status || EMPTY}</td>
      </tr>)}</tbody>
    </table></div>}
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={`Карточка сотрудника ${selected.plan_name}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelected(null)} aria-label="Закрыть">×</button>
        <p className="eyebrow">КАРТОЧКА СОТРУДНИКА</p>
        <h3>{selected.plan_name}</h3>
        {!EDITORS.includes(role) && <p>Просмотр личной карточки. Изменение данных доступно HR и администратору.</p>}
        <div className="kpis hr-card-summary">
          <div className="card"><small>Офис</small><b>{selected.office || EMPTY}</b></div>
          <div className="card"><small>Отдел</small><b>{selected.department || selected.plan_department}</b></div>
          <div className="card"><small>Должность</small><b>{selected.position || EMPTY}</b></div>
          <div className="card"><small>Статус в отделе</small><b>{selected.department_status || EMPTY}</b></div>
          <div className="card"><small>Дата приёма</small><b>{selected.hire_date || EMPTY}</b></div>
          <div className="card"><small>Распорядок</small><b>{selected.work_schedule || EMPTY}</b></div>
        </div>
        {EDITORS.includes(role) && <div className="hr-card-form">
          <h4>Личные и рабочие данные</h4>
          <p className="muted">ФИО из первичной загрузки «План» не изменяется в этой форме.</p>
          <label>Офис<input value={draft.office || ''} onChange={(event) => setDraft({...draft, office: event.target.value})}/></label>
          <label>Отдел<input value={draft.department || ''} onChange={(event) => setDraft({...draft, department: event.target.value})}/></label>
          <label>Должность<input value={draft.position || ''} onChange={(event) => setDraft({...draft, position: event.target.value})}/></label>
          <label>Статус в отделе<select value={draft.department_status || ''} onChange={(event) => setDraft({...draft, department_status: event.target.value})}>{DEPARTMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Пол<select value={draft.gender || ''} onChange={(event) => setDraft({...draft, gender: event.target.value})}><option>Не указан</option><option>Женский</option><option>Мужской</option></select></label>
          <label>Год рождения<input type="number" min="1900" max="2100" value={draft.birth_year || ''} onChange={(event) => setDraft({...draft, birth_year: event.target.value})}/></label>
          <label>Дата приёма<input type="date" value={draft.hire_date || ''} onChange={(event) => setDraft({...draft, hire_date: event.target.value})}/></label>
          <label>Распорядок<input value={draft.work_schedule || ''} placeholder="Например, 5/2, 09:00–18:00" onChange={(event) => setDraft({...draft, work_schedule: event.target.value})}/></label>
          <label>Руководитель отдела<select value={draft.department_head_id || ''} onChange={(event) => setDraft({...draft, department_head_id: event.target.value})}><option value="">Не назначен</option>{items.filter((employee) => employee.id !== selected.id).map((employee) => <option key={employee.id} value={employee.id}>{employee.plan_name}</option>)}</select></label>
          <label>Заместитель на период<select value={draft.deputy_id || ''} onChange={(event) => setDraft({...draft, deputy_id: event.target.value})}><option value="">Не назначен</option>{items.filter((employee) => employee.id !== selected.id).map((employee) => <option key={employee.id} value={employee.id}>{employee.plan_name}</option>)}</select></label>
          <label>Замещение с<input type="date" value={draft.deputy_from || ''} onChange={(event) => setDraft({...draft, deputy_from: event.target.value})}/></label>
          <label>Замещение по<input type="date" value={draft.deputy_until || ''} onChange={(event) => setDraft({...draft, deputy_until: event.target.value})}/></label>
          <label>Статус занятости<select value={draft.employment_status || ''} onChange={(event) => setDraft({...draft, employment_status: event.target.value})}><option value="active">Работает</option><option value="leave">В отпуске</option><option value="inactive">Неактивен</option></select></label>
          <div className="actions"><button className="primary" disabled={saving} onClick={saveCard}>{saving ? 'Сохраняем…' : 'Сохранить карточку'}</button></div>
        </div>}
      </div>
    </div>}
  </section>;
}

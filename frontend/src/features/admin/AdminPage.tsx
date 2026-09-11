import {useEffect, useState} from 'react';
import {api, errorText} from '../../shared/api/client';

type User = {username: string; role: string; department: string};
type Backup = {id: string; filename?: string; size?: number; checksum?: string};

export function AdminPage({notify}: {notify: (message: string) => void}) {
  const [users, setUsers] = useState<User[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api<{items: User[]}>('/api/admin/users'), api<{items?: Backup[]}>('/api/admin/backups').catch(() => ({items: []}))])
      .then(([userResponse, backupResponse]) => { setUsers(userResponse.items); setBackups(backupResponse.items || []); })
      .catch((error) => notify(errorText(error)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const backup = await api<Backup>('/api/admin/backups', {method: 'POST'});
      setBackups((current) => [backup, ...current]);
      notify('Резервная копия создана и проверена');
    } catch (error) { notify(errorText(error)); } finally { setCreating(false); }
  };

  return <section className="card hr-page">
    <div className="pagehead"><div><p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p><h2>Сопровождение системы</h2><p>Пользователи, права доступа и резервные копии.</p></div><button onClick={load}>Обновить</button></div>
    {loading ? <p role="status">Загружаем данные администрирования…</p> : <>
      <section className="card"><h3>Пользователи и уровни доступа</h3><div className="table-scroll"><table><thead><tr><th>Пользователь</th><th>Роль</th><th>Отдел</th></tr></thead><tbody>{users.map((user) => <tr key={user.username}><td>{user.username}</td><td>{user.role}</td><td>{user.department || '—'}</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="pagehead"><div><h3>Резервное копирование БД</h3><p>Копия PostgreSQL проверяется перед добавлением в список.</p></div><button className="primary" disabled={creating} onClick={createBackup}>{creating ? 'Создаём…' : 'Создать backup'}</button></div><div className="table-scroll"><table><thead><tr><th>Идентификатор</th><th>Файл</th><th>Размер</th><th>Контрольная сумма</th></tr></thead><tbody>{backups.length ? backups.map((backup) => <tr key={backup.id}><td>{backup.id}</td><td>{backup.filename || '—'}</td><td>{backup.size ?? '—'}</td><td>{backup.checksum || '—'}</td></tr>) : <tr><td colSpan={4}>Резервные копии ещё не созданы.</td></tr>}</tbody></table></div></section>
    </>}
  </section>;
}

ROLES = {
    'admin': 'Системный администратор',
    'timekeeper': 'Администратор табельного учёта',
    'hr': 'HR-служба',
    'manager': 'Руководитель отдела',
    'executive': 'Топ-менеджер',
    'employee': 'Сотрудник',
    'auditor': 'Аудитор',
}
WRITERS = {'admin', 'timekeeper', 'hr'}

def allowed(user: dict, employee: dict) -> bool:
    if user['role'] == 'manager':
        return employee['department'] == user.get('department')
    if user['role'] == 'employee':
        return employee['id'] == user.get('employee_id')
    return user['role'] in ROLES

def scope_result(user: dict, result: dict) -> dict:
    employees = [e for e in result['employees'] if allowed(user, e)]
    ids = {e['id'] for e in employees}
    return {
        **result,
        'employees': employees,
        'days': [d for d in result['days'] if d['id'] in ids],
        'unmatched': [] if user['role'] in ('employee', 'manager') else result['unmatched'],
    }

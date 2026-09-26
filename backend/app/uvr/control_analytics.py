def control_summary(rows:list[dict],allowed_employee_ids:set[str])->dict:
 scoped=[row for row in rows if row.get('employee_id') in allowed_employee_ids]
 return {'employees':len({row['employee_id'] for row in scoped}),'active_hours':sum(row.get('active_hours') or 0 for row in scoped),'useful_hours':sum(row.get('useful_hours') or 0 for row in scoped),'hh_minutes':sum(row.get('hh_minutes') or 0 for row in scoped)}

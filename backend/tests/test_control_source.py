import io,unittest
from openpyxl import Workbook
from backend.app.infrastructure.excel.control_reader import CONTROL_HEADERS,read_control_xlsx
from backend.app.uvr.control_analytics import control_summary

def blob(rows):
 w=Workbook();s=w.active;s.append(CONTROL_HEADERS)
 for row in rows:s.append(row)
 out=io.BytesIO();w.save(out);return out.getvalue()

class ControlSourceTests(unittest.TestCase):
 def test_eight_headers_and_numeric_metrics(self):
  rows=read_control_xlsx(blob([['Buying','Иванов Иван',120.5,90,'текст контроля',None,'замечание',12]]),'2026-08')
  self.assertEqual((len(rows),rows[0]['active_hours'],rows[0]['hh_minutes']),(1,120.5,12.0))
  self.assertEqual(rows[0]['attendance_note'],'текст контроля')
 def test_invalid_number_and_blank_employee_are_reported(self):
  rows=read_control_xlsx(blob([['Buying',None,'bad',90,None,None,None,None]]),'2026-08')
  self.assertEqual({e['field'] for e in rows[0]['errors']},{'name','active_hours'})
 def test_summary_does_not_turn_text_into_absence(self):
  summary=control_summary([{'employee_id':'1','active_hours':120,'useful_hours':80,'hh_minutes':10,'attendance_note':'Прогулы/переработки'}],{'1'})
  self.assertEqual(summary['active_hours'],120)
  self.assertNotIn('absence',summary)

if __name__=='__main__':unittest.main()

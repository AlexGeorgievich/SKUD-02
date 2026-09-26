import unittest
from pathlib import Path
from backend.app.infrastructure.excel.control_reader import read_control_xlsx
from backend.app.infrastructure.excel.reader import read_input

ROOT=Path(__file__).resolve().parents[2]
class DemoControlTests(unittest.TestCase):
 def test_august_demo_covers_plan_linked_kus_roster(self):
  control=read_control_xlsx((ROOT/'demo'/'Demo-control.xlsx').read_bytes(),'2026-08')
  plan=read_input((ROOT/'demo'/'plan.xlsx').read_bytes(),'plan','2026-08')
  self.assertEqual(len(control),166);self.assertEqual(len({row['name'] for row in control}),166)
  self.assertEqual({row['name'] for row in control},{row['name'] for row in plan})
  self.assertEqual(len({row['department'] for row in control}),17)
  self.assertFalse(any(row['errors'] for row in control))
  self.assertTrue(all(isinstance(row['active_hours'],float) for row in control))
  self.assertTrue(all(0<=row['useful_hours']<=row['active_hours']<=168 for row in control))
if __name__=='__main__':unittest.main()

import unittest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.hr.models import Base
from backend.app.uvr.repository import UvrRepository
from backend.app.uvr.service import UvrService


class UvrHistoryTests(unittest.TestCase):
    def setUp(self):
        engine=create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(engine);self.addCleanup(engine.dispose)
        self.service=UvrService(UvrRepository(engine))
        self.rows=[{'row_number':1,'name':'Иванов Иван','department':'Buying','values':['О']}]
        self.mapping={1:'kus-1'}

    def test_months_versions_and_idempotent_file(self):
        first=self.service.publish('2026-08','plan',b'august',self.rows,self.mapping,'admin')
        again=self.service.publish('2026-08','plan',b'august',self.rows,self.mapping,'admin')
        september=self.service.publish('2026-09','plan',b'september',self.rows,self.mapping,'admin')
        self.assertEqual((first['version'],again['version'],again['status'],september['version']),(1,1,'unchanged',1))
        self.assertEqual([item['period'] for item in self.service.periods()],['2026-09','2026-08'])

    def test_closed_month_needs_reason_and_preserves_old_version(self):
        self.service.publish('2026-08','plan',b'v1',self.rows,self.mapping,'admin')
        self.service.close('2026-08','admin')
        with self.assertRaises(ValueError):self.service.publish('2026-08','plan',b'v2',self.rows,self.mapping,'admin')
        revised=self.service.publish('2026-08','plan',b'v2',self.rows,self.mapping,'admin',reason='Исправление источника')
        self.assertEqual(revised['version'],2)
        history=self.service.period('2026-08')['sources']['plan']
        self.assertEqual([item['version'] for item in history],[1,2])
        self.assertEqual(history[0]['rows'][0]['source_name'],'Иванов Иван')

if __name__=='__main__':unittest.main()

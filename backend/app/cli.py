import argparse
import getpass
from pathlib import Path
from .config import Settings
from .container import build_container
from .domain.access import ROLES
from .domain.errors import ServiceError
from .infrastructure.excel.generator import generate

def main():
    parser = argparse.ArgumentParser(description='TimeTrack Pro — PPL Group')
    sub = parser.add_subparsers(dest='command', required=True)
    add = sub.add_parser('user')
    add.add_argument('username')
    add.add_argument('--role', choices=ROLES, default='admin')
    add.add_argument('--department', default='')
    add.add_argument('--employee', default='')
    gen = sub.add_parser('generate')
    gen.add_argument('--period', default='2026-08')
    gen.add_argument('--out', default='demo')
    args = parser.parse_args()
    try:
        if args.command == 'generate':
            plan, fact = generate(args.period)
            dest = Path(args.out)
            dest.mkdir(parents=True, exist_ok=True)
            (dest / 'plan.xlsx').write_bytes(plan)
            (dest / 'skud_fact.xlsx').write_bytes(fact)
            print('Созданы:', dest / 'plan.xlsx', dest / 'skud_fact.xlsx')
        else:
            c = build_container(Settings())
            if args.username in c.repository.read_users():
                raise ServiceError('Пользователь уже существует; запись не изменена.')
            password = getpass.getpass('Пароль (12–200 символов): ')
            if password != getpass.getpass('Повторите пароль: '):
                raise ServiceError('Пароли не совпадают')
            c.auth.create_user(args.username, password, args.role, args.department, args.employee)
            print('Пользователь создан:', args.username)
    except (ServiceError, ValueError) as exc:
        parser.exit(1, str(exc) + '\n')

if __name__ == '__main__':
    main()

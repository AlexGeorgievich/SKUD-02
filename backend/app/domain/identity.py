import hashlib
import hmac
import re
import unicodedata

def normalize(name):
    value=' '.join(unicodedata.normalize('NFKC',str(name or '')).split()).casefold()
    if not re.fullmatch(r"[а-яёa-z]+(?:[-'][а-яёa-z]+)* [а-яёa-z]+(?:[-'][а-яёa-z]+)*",value):
        raise ValueError('Ожидаются только фамилия и имя; инициалы и ФИО требуют уточнения')
    return value  # е/ё and transliteration are NOT silently merged


def token(name,key):
    return 'EMP-'+hmac.new(key,normalize(name).encode(),hashlib.sha256).hexdigest()


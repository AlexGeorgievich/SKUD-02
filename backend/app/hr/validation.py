"""Input normalization shared by KUS API and Excel import."""

import re
from urllib.parse import urlparse


EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
TELEGRAM = re.compile(r"^@[A-Za-z0-9_]{5,32}$")


def normalize_contact(kind: str, value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    cleaned = value.strip()
    if kind == "email":
        if not EMAIL.fullmatch(cleaned):
            raise ValueError("Укажите корректный адрес электронной почты")
        return cleaned.lower()
    if kind == "telegram":
        if cleaned.startswith("https://t.me/"):
            parsed = urlparse(cleaned)
            if parsed.query or parsed.fragment or parsed.path.count("/") != 1:
                raise ValueError("Укажите @username или ссылку https://t.me/username")
            cleaned = "@" + parsed.path[1:]
        if not TELEGRAM.fullmatch(cleaned):
            raise ValueError("Укажите @username или ссылку https://t.me/username")
        return cleaned
    if kind == "phone":
        digits = re.sub(r"[\s()\-]", "", cleaned)
        if digits.startswith("8") and len(digits) == 11:
            digits = "+7" + digits[1:]
        if not digits.startswith("+") or not digits[1:].isdigit() or not 8 <= len(digits[1:]) <= 15:
            raise ValueError("Укажите телефон в международном формате")
        return digits
    raise ValueError("Неизвестный тип контакта")

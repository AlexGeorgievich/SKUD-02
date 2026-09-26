"""Validated, local-only personnel photos."""

from pathlib import Path
from uuid import uuid4
import os


MAX_PHOTO_BYTES = 5 * 1024 * 1024


def image_extension(blob: bytes) -> str:
    if not blob or len(blob) > MAX_PHOTO_BYTES:
        raise ValueError("Фото должно быть не больше 5 МБ")
    if blob.startswith(b"\x89PNG\r\n\x1a\n") and b"IHDR" in blob[:32]:
        return ".png"
    if blob.startswith(b"\xff\xd8\xff") and blob.endswith(b"\xff\xd9"):
        return ".jpg"
    if blob.startswith(b"RIFF") and blob[8:12] == b"WEBP":
        return ".webp"
    raise ValueError("Разрешены только изображения PNG, JPEG или WEBP")


def save_photo(data_dir: Path, employee_id: str, blob: bytes) -> str:
    extension = image_extension(blob)
    directory = data_dir / "hr_photos"
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{employee_id}{extension}"
    temporary = directory / f".{uuid4()}.tmp"
    try:
        temporary.write_bytes(blob)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    return target.name


def photo_file(data_dir: Path, stored_name: str | None) -> Path | None:
    if not stored_name or Path(stored_name).name != stored_name:
        return None
    path = data_dir / "hr_photos" / stored_name
    return path if path.is_file() else None

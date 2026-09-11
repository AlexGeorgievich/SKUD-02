"""Controlled PostgreSQL dump runner; never returns credentials or dump contents."""
from hashlib import sha256
from pathlib import Path
import os
import subprocess
from uuid import uuid4


class BackupRunner:
    def __init__(self, database_url: str, directory: Path):
        self.database_url, self.directory = database_url, directory

    def create(self) -> dict:
        self.directory.mkdir(parents=True, exist_ok=True)
        target = self.directory / f"timetrack-{uuid4()}.dump"
        subprocess.run(["pg_dump", "--format=custom", "--file", str(target), self.database_url], check=True, env=os.environ.copy(), capture_output=True)
        subprocess.run(["pg_restore", "--list", str(target)], check=True, capture_output=True)
        return {"id": target.stem, "checksum_sha256": sha256(target.read_bytes()).hexdigest(), "size": target.stat().st_size}

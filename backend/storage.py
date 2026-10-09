import os
import shutil
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename
from .crypto import compute_file_sha256

STORAGE_DIR = Path(__file__).resolve().parent.parent / 'storage'
EVIDENCE_DIR = STORAGE_DIR / 'evidence'
STAGING_DIR = STORAGE_DIR / 'staging'

MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

PERMITTED_EXTENSIONS = {
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.bmp',
    '.txt', '.csv', '.json', '.xml', '.log',
    '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav',
    '.zip', '.tar', '.gz', '.7z',
    '.dd', '.raw', '.e01', '.iso', '.pcap', '.pcapng', '.bin', '.dat'
}

def ensure_storage_dirs():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(STORAGE_DIR, 0o700)
        os.chmod(EVIDENCE_DIR, 0o700)
        os.chmod(STAGING_DIR, 0o700)
    except Exception:
        pass

def is_permitted_file(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in PERMITTED_EXTENSIONS

def sanitize_filename_str(filename: str) -> str:
    cleaned = secure_filename(filename)
    return cleaned if cleaned else 'evidence_item.bin'

def commit_staged_evidence(staged_path: Path, original_filename: str):
    ensure_storage_dirs()
    if not staged_path.exists():
        raise FileNotFoundError("Staged file not found")

    size = staged_path.stat().st_size
    if size == 0:
        staged_path.unlink(missing_ok=True)
        raise ValueError("Empty file: zero bytes received")

    if size > MAX_FILE_SIZE_BYTES:
        staged_path.unlink(missing_ok=True)
        raise ValueError("File exceeds maximum allowable size")

    sha256 = compute_file_sha256(staged_path)

    ext = Path(original_filename).suffix.lower()
    storage_key = f"ev_{uuid.uuid4()}{ext}"
    final_path = EVIDENCE_DIR / storage_key

    shutil.move(str(staged_path), str(final_path))
    os.chmod(final_path, 0o600)

    return {
        'storage_key': storage_key,
        'sha256': sha256,
        'size_bytes': size,
        'final_path': str(final_path)
    }

def get_safe_evidence_path(storage_key: str) -> Path:
    safe_name = Path(storage_key).name
    resolved = (EVIDENCE_DIR / safe_name).resolve()
    if not str(resolved).startswith(str(EVIDENCE_DIR.resolve())):
        raise PermissionError("Attempted path traversal violation")
    return resolved

def simulate_tamper_file(storage_key: str, alteration_bytes: bytes = b"\n[TAMPERED_BYTE_INJECTION]"):
    path = get_safe_evidence_path(storage_key)
    if not path.exists():
        raise FileNotFoundError("Evidence file not found")
    with open(path, 'ab') as f:
        f.write(alteration_bytes)

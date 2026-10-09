import hashlib
import json
import os
import uuid
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.exceptions import InvalidSignature
from werkzeug.security import generate_password_hash, check_password_hash

KEYS_DIR = Path(__file__).resolve().parent.parent / 'keys'
PRIVATE_KEY_PATH = KEYS_DIR / 'signing_private_key.pem'
PUBLIC_KEY_PATH = KEYS_DIR / 'signing_public_key.pem'

def ensure_keypair():
    KEYS_DIR.mkdir(parents=True, exist_ok=True)
    if not PRIVATE_KEY_PATH.exists() or not PUBLIC_KEY_PATH.exists():
        # Generate NIST P-256 (secp256r1) keypair
        private_key = ec.generate_private_key(ec.SECP256R1())
        public_key = private_key.public_key()

        pem_private = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        pem_public = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

        with open(PRIVATE_KEY_PATH, 'wb') as f:
            f.write(pem_private)
        os.chmod(PRIVATE_KEY_PATH, 0o600)

        with open(PUBLIC_KEY_PATH, 'wb') as f:
            f.write(pem_public)
        os.chmod(PUBLIC_KEY_PATH, 0o644)

    with open(PUBLIC_KEY_PATH, 'r') as f:
        public_pem = f.read()

    key_id = 'KEY-P256-' + hashlib.sha256(public_pem.encode()).hexdigest()[:16].upper()
    return public_pem, key_id

def get_public_key_pem():
    if not PUBLIC_KEY_PATH.exists():
        return ensure_keypair()[0]
    with open(PUBLIC_KEY_PATH, 'r') as f:
        return f.read()

def get_key_id():
    pem = get_public_key_pem()
    return 'KEY-P256-' + hashlib.sha256(pem.encode()).hexdigest()[:16].upper()

def compute_file_sha256(file_path):
    """
    Computes SHA-256 over raw file bytes using chunked streaming (64KB blocks).
    """
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(64 * 1024):
            sha256.update(chunk)
    return sha256.hexdigest().lower()

def compute_buffer_sha256(buffer: bytes) -> str:
    return hashlib.sha256(buffer).hexdigest().lower()

def canonical_json(obj: any) -> str:
    """
    Deterministically serializes any dictionary per RFC 8785 principles.
    Recursively sorts keys without extraneous whitespace.
    """
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def compute_custody_event_hash(payload: dict, prev_hash: str) -> str:
    canonical = canonical_json(payload)
    to_hash = f"{prev_hash}:{canonical}".encode('utf-8')
    return hashlib.sha256(to_hash).hexdigest().lower()

def sign_checkpoint_payload(payload: dict):
    ensure_keypair()
    with open(PRIVATE_KEY_PATH, 'rb') as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    canonical = canonical_json(payload).encode('utf-8')
    signature = private_key.sign(canonical, ec.ECDSA(hashes.SHA256()))

    public_pem = get_public_key_pem()
    key_id = get_key_id()

    return {
        'signature_hex': signature.hex(),
        'key_id': key_id,
        'algorithm': 'ECDSA-SHA256 (NIST P-256)',
        'public_key_pem': public_pem
    }

def verify_checkpoint_signature(payload: dict, signature_hex: str, public_key_pem: str) -> bool:
    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode('utf-8'))
        canonical = canonical_json(payload).encode('utf-8')
        sig_bytes = bytes.fromhex(signature_hex)
        public_key.verify(sig_bytes, canonical, ec.ECDSA(hashes.SHA256()))
        return True
    except (InvalidSignature, Exception):
        return False

def hash_password(password: str) -> str:
    return generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)

def verify_password(plain: str, hashed: str) -> bool:
    return check_password_hash(hashed, plain)

def generate_id(prefix: str = '') -> str:
    u = str(uuid.uuid4())
    return f"{prefix}_{u}" if prefix else u

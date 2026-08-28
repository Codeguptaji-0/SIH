import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.config import settings

logger = logging.getLogger(__name__)

MIN_SECRET_KEY_LENGTH = 32


def _resolve_secret_key() -> str:
    """
    Resolve the JWT signing key from configuration.

    There is deliberately NO hardcoded fallback literal. The previous version had
    one in this git-tracked file, which made the signing key public: an ADMIN token
    could be forged from published repository values alone, with no password, and
    require_role("ADMIN") accepted it. A default value in source is not a default,
    it is a published credential.

    When SECRET_KEY is unset:
      * DEMO_MODE=True  -> generate a random per-process key. Tokens are invalidated
        by a restart, which is inconvenient for a demo but never forgeable.
      * DEMO_MODE=False -> refuse to start. A real deployment must supply a key.
    """
    configured = (settings.SECRET_KEY or "").strip()
    if configured:
        if len(configured) < MIN_SECRET_KEY_LENGTH:
            raise RuntimeError(
                "SECRET_KEY is too short (%d chars). Use at least %d. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
                % (len(configured), MIN_SECRET_KEY_LENGTH)
            )
        return configured

    if settings.DEMO_MODE:
        logger.warning(
            "SECRET_KEY is not set. Generating an ephemeral key for this process "
            "because DEMO_MODE=True. Existing tokens will not survive a restart. "
            "Set SECRET_KEY in .env before any shared or public deployment."
        )
        return secrets.token_urlsafe(48)

    raise RuntimeError(
        "SECRET_KEY is not set and DEMO_MODE is False. Refusing to start with an "
        "unknown signing key. Set SECRET_KEY in the environment or .env file."
    )


SECRET_KEY = _resolve_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

try:
    from jose import jwt, JWTError
    HAS_JOSE = True
except ImportError:  # pragma: no cover
    HAS_JOSE = False

# Tokens must be cryptographically signed. python-jose is a declared dependency in
# requirements.txt, so if it is missing the correct behaviour is to fail loudly rather
# than silently downgrade to unsigned tokens that anyone could forge.
_JOSE_MISSING_MESSAGE = (
    "python-jose is not installed, so access tokens cannot be signed. "
    "Install dependencies with: pip install -r requirements.txt"
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
# PBKDF2-HMAC-SHA256 from the Python standard library. This needs no third-party
# package, and PBKDF2 is an approved password-hashing scheme under NIST SP 800-63B,
# which matters for a government deployment context.
#
# Stored format is self-describing so the scheme can be migrated later without a
# flag day (e.g. to bcrypt or Argon2 via passlib):
#
#     pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
#
PASSWORD_ALGORITHM = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000  # OWASP-recommended minimum for PBKDF2-HMAC-SHA256
SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Hash a plaintext password with a fresh random salt."""
    if not password:
        raise ValueError("Password must not be empty")
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"{PASSWORD_ALGORITHM}${PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Check a plaintext password against a stored hash.

    Fails closed: anything that is not a well-formed hash of a supported algorithm
    returns False. This is deliberate, so legacy placeholder values such as
    'demo_hash_official' can never be treated as a match.
    """
    if not password or not stored_hash:
        return False

    parts = stored_hash.split("$")
    if len(parts) != 4:
        return False

    algorithm, iterations_raw, salt_hex, expected_hex = parts
    if algorithm != PASSWORD_ALGORITHM:
        return False

    try:
        iterations = int(iterations_raw)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hex)
    except ValueError:
        return False

    if iterations < 1 or not salt or not expected:
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    # Constant-time comparison, so response timing does not leak the hash.
    return hmac.compare_digest(candidate, expected)


# ---------------------------------------------------------------------------
# Access tokens
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    if not HAS_JOSE:
        raise RuntimeError(_JOSE_MISSING_MESSAGE)

    to_encode = data.copy()

    # Timezone-aware UTC, deliberately not datetime.utcnow().
    #
    # utcnow() returns a NAIVE datetime holding UTC wall-clock time, and calling
    # .timestamp() on a naive datetime makes Python interpret it as LOCAL time.
    # On an IST machine (UTC+5:30) that produced an `exp` 19,800 seconds in the
    # past - larger than the 120-minute lifetime - so every token was issued
    # already expired and every authenticated request failed with 401. The bug
    # was invisible while decode_access_token() still had an unsigned fallback
    # that read the payload without checking `exp`.
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        # Unique token ID. Without it, two logins by the same user inside the same
        # second produce byte-identical tokens, because the payload and the
        # whole-second `exp` are identical and JWT signing is deterministic. The
        # revocation list in revoke_token() stores token strings, so identical
        # tokens would mean logging out of one session revoked every other
        # session for that user.
        "jti": secrets.token_urlsafe(16),
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# In-memory token revocation blacklist (Note: In a distributed production deployment, Redis would be used for token blacklisting)
REVOKED_TOKENS = set()

def revoke_token(token: str):
    if not token:
        return
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    REVOKED_TOKENS.add(token)

def decode_access_token(token: str) -> Optional[dict]:
    """
    Verify and decode an access token.

    Returns None for anything that does not carry a valid HS256 signature. There is
    deliberately no unsigned fallback path: accepting an unverified payload would let
    a caller mint their own token and choose their own role.
    """
    if not token:
        return None
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    if token in REVOKED_TOKENS:
        return None

    if not HAS_JOSE:
        raise RuntimeError(_JOSE_MISSING_MESSAGE)

    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def get_current_user_from_token(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(authorization)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user ID.",
        )

    # Resolve strictly by the subject in the signed token. There is no role-based
    # fallback: matching "the first user with this role" would let a token with an
    # unknown subject resolve to somebody else's account.
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found.",
        )

    return user

def require_role(*allowed_roles: str):
    """
    RBAC dependency requiring current user to possess one of the allowed_roles.
    Returns HTTP 403 FORBIDDEN if user role is not permitted.
    """
    def role_checker(current_user: User = Depends(get_current_user_from_token)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{current_user.role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker

import re

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import create_access_token, hash_password, verify_password
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.errors import ConflictError, UnauthorizedError


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "tenant"


def _unique_slug(db: Session, base: str) -> str:
    slug = base
    index = 2
    while db.scalar(select(Tenant.id).where(Tenant.slug == slug)) is not None:
        slug = f"{base}-{index}"
        index += 1
    return slug


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.tenant))
    )


def register_user(db: Session, payload: RegisterRequest) -> User:
    email = payload.email.strip().lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise ConflictError("Email already registered")

    tenant = Tenant(
        name=payload.tenant_name.strip(),
        slug=_unique_slug(db, _slugify(payload.tenant_name)),
    )
    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        tenant=tenant,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, payload: LoginRequest) -> TokenResponse:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    token = create_access_token(user_id=user.id, tenant_id=user.tenant_id)
    return TokenResponse(access_token=token)


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        tenant_id=user.tenant_id,
        tenant_name=user.tenant.name,
    )

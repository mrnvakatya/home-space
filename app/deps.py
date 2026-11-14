from typing import Iterator, Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    uid = request.session.get("uid")
    return db.get(User, uid) if uid else None


def current_user(user: Optional[User] = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Требуется вход")
    return user

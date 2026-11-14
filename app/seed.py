"""Демо-данные: python -m app.seed
Создаёт пользователя demo@homespace.app / password123 и несколько задач.
"""
from datetime import date, datetime, time, timedelta

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import FocusSession, Task, User
from app.security import hash_password


def main() -> None:
    Base.metadata.create_all(engine)
    today = date.today()
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == "demo@homespace.app")):
            print("Демо-пользователь уже существует")
            return
        user = User(email="demo@homespace.app", name="Катя", password_hash=hash_password("password123"))
        db.add(user)
        db.flush()
        rows = [
            ("Записаться к стоматологу", "health", "todo", 3, time(10, 0)),
            ("Сверстать лендинг для клиента", "work", "todo", 5, time(18, 0)),
            ("Купить продукты на неделю", "home", "todo", 1, None),
            ("Написать вторую главу курсовой", "study", "doing", 4, time(12, 0)),
            ("Созвон по правкам макета", "work", "doing", 0, time(16, 30)),
            ("Оплатить интернет", "home", "done", -1, None),
        ]
        tasks = []
        for title, tag, status, shift, at in rows:
            t = Task(user_id=user.id, title=title, tag=tag, status=status,
                     due_date=today + timedelta(days=shift), due_time=at)
            db.add(t)
            tasks.append(t)
        db.flush()
        db.add(FocusSession(user_id=user.id, task_id=tasks[3].id, minutes=50,
                            created_at=datetime.now() - timedelta(days=1)))
        db.commit()
    print("Готово: demo@homespace.app / password123")


if __name__ == "__main__":
    main()

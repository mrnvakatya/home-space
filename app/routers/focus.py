from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import current_user, get_db
from app.models import FocusSession, Task, User
from app.schemas import FocusIn

router = APIRouter(prefix="/api/focus", tags=["focus"])


@router.post("/sessions", status_code=201)
def add_session(data: FocusIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Записывает завершённую сессию Pomodoro в хронометраж задачи."""
    task = db.get(Task, data.task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    db.add(FocusSession(user_id=user.id, task_id=task.id, minutes=data.minutes))
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(
    month: str = Query(default="", pattern=r"^(\d{4}-\d{2})?$"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Минуты фокуса по дням месяца (для трекера) и по задачам."""
    now = datetime.now()
    month = month or now.strftime("%Y-%m")
    year, mon = int(month[:4]), int(month[5:7])
    start = datetime(year, mon, 1)
    end = datetime(year + (mon == 12), mon % 12 + 1, 1)
    rows = db.scalars(
        select(FocusSession).where(
            FocusSession.user_id == user.id,
            FocusSession.created_at >= start,
            FocusSession.created_at < end,
        )
    ).all()
    days: dict[str, int] = defaultdict(int)
    by_task: dict[int, int] = defaultdict(int)
    for s in rows:
        days[s.created_at.strftime("%Y-%m-%d")] += s.minutes
        by_task[s.task_id] += s.minutes
    titles = {t.id: t.title for t in db.scalars(select(Task).where(Task.id.in_(by_task or [0])))}
    return {
        "month": month,
        "days": dict(days),
        "total": sum(days.values()),
        "by_task": [{"task_id": i, "title": titles.get(i, ""), "minutes": m} for i, m in by_task.items()],
    }

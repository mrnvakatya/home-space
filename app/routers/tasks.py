from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.deps import current_user, get_db
from app.models import Task, User
from app.schemas import NoteIn, ParsedNoteOut, TaskIn, TaskOut, TaskPatch
from app.nlp import parse_note

router = APIRouter(prefix="/api", tags=["tasks"])


def task_out(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        tag=task.tag,
        status=task.status,
        due_date=task.due_date,
        due_time=task.due_time.strftime("%H:%M") if task.due_time else None,
        archived=task.archived,
        focus_minutes=task.focus_minutes,
    )


def get_own_task(task_id: int, db: Session, user: User) -> Task:
    task = db.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return task


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(archived: bool = False, db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = (
        select(Task)
        .where(Task.user_id == user.id, Task.archived == archived)
        .options(selectinload(Task.sessions))
        .order_by(Task.created_at.desc())
    )
    return [task_out(t) for t in db.scalars(stmt)]


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(data: TaskIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = Task(user_id=user.id, **data.model_dump())
    db.add(task)
    db.commit()
    return task_out(task)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = get_own_task(task_id, db, user)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field in ("title", "tag", "status", "description", "archived"):
            continue  # эти поля нельзя обнулить
        setattr(task, field, value)
    db.commit()
    return task_out(task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(get_own_task(task_id, db, user))
    db.commit()


@router.post("/notes/parse", response_model=ParsedNoteOut)
def parse(data: NoteIn, _: User = Depends(current_user)):
    """Умная заметка: возвращает распознанные название, срок и тег (без сохранения)."""
    p = parse_note(data.text)
    return ParsedNoteOut(
        title=p.title,
        due_date=p.due_date,
        due_time=p.due_time.strftime("%H:%M") if p.due_time else None,
        tag=p.tag,
    )


@router.post("/notes", response_model=TaskOut, status_code=201)
def create_from_note(data: NoteIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Умная заметка: распознаёт текст и сразу создаёт карточку задачи."""
    p = parse_note(data.text)
    task = Task(user_id=user.id, title=p.title, tag=p.tag, due_date=p.due_date, due_time=p.due_time)
    db.add(task)
    db.commit()
    return task_out(task)

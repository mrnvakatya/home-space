from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, Field

Tag = Literal["work", "study", "home", "health"]
Status = Literal["todo", "doing", "done"]


class RegisterIn(BaseModel):
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=100)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = ""
    tag: Tag = "work"
    status: Status = "todo"
    due_date: Optional[date] = None
    due_time: Optional[time] = None


class TaskPatch(BaseModel):
    """Все поля необязательны. Меняются только те, что переданы в запросе."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    tag: Optional[Tag] = None
    status: Optional[Status] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    archived: Optional[bool] = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    tag: Tag
    status: Status
    due_date: Optional[date]
    due_time: Optional[str]  # "HH:MM"
    archived: bool
    focus_minutes: int


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ParsedNoteOut(BaseModel):
    title: str
    due_date: Optional[date]
    due_time: Optional[str]
    tag: Tag


class FocusIn(BaseModel):
    task_id: int
    minutes: int = Field(ge=1, le=240)

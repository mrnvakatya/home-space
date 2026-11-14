"""Разбор заметок на естественном русском языке.

Из текста вроде «Подготовить отчет по практике к пятнице 15:00» получаем
название задачи, дедлайн (дата и время) и тег.

Это rule-based реализация (правила + ключевые слова). Она закрывает требования
КТ-2 без обученной модели. Когда появится BERT/NER-сервис (FastAPI), его можно
подключить вместо `parse_note`: достаточно вернуть такой же `ParsedNote`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Optional

PREP = r"(?:(?:к|на|в|во|до|ко)\s+)?"

WEEKDAYS = [  # (корень слова, номер дня: понедельник = 0)
    ("понедельник", 0),
    ("вторник", 1),
    ("сред", 2),
    ("четверг", 3),
    ("пятниц", 4),
    ("суббот", 5),
    ("воскресень", 6),
]
MONTHS = [
    "январ", "феврал", "март", "апрел", "ма[йя]", "июн",
    "июл", "август", "сентябр", "октябр", "ноябр", "декабр",
]

TAG_KEYWORDS = {
    "study": [
        "практик", "курсов", "лекци", "экзамен", "зачет", "зачёт", "реферат", "диплом",
        "учеб", "семинар", "препод", "универ", "домашн", "конспект", "студен",
    ],
    "work": [
        "клиент", "созвон", "встреч", "проект", "письм", "макет", "заказчик", "презентац",
        "договор", "бриф", "работ", "коммерческ", "лендинг", "смет", "коллег",
    ],
    "health": [
        "врач", "стоматолог", "анализ", "таблет", "трениров", "спорт", "бег", "йог",
        "поликлиник", "витамин", "массаж", "зал",
    ],
    "home": [
        "купить", "продукт", "магазин", "оплат", "уборк", "стирк", "квартир", "коммунал",
        "заказать", "ремонт", "почт", "маме", "позвонить", "приготов",
    ],
}


@dataclass
class ParsedNote:
    title: str
    due_date: Optional[date]
    due_time: Optional[time]
    tag: str


def _cut(pattern: str, text: str) -> tuple[Optional[re.Match], str]:
    """Находит первое совпадение и вырезает его из текста."""
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return None, text
    return m, text[: m.start()] + " " + text[m.end():]


def classify_tag(text: str) -> str:
    low = text.lower()
    best, best_n = "work", 0
    for tag, words in TAG_KEYWORDS.items():
        n = sum(1 for w in words if w in low)
        if n > best_n:
            best, best_n = tag, n
    return best


def parse_note(text: str, now: Optional[datetime] = None) -> ParsedNote:
    now = now or datetime.now()
    t = " " + text.strip()
    due: Optional[date] = None
    at: Optional[time] = None

    # --- время: «15:00», «в 5 часов», «утром», «вечером» ---
    m, t = _cut(rf"\s{PREP}(\d{{1,2}})[:.](\d{{2}})(?!\d)", t)
    if m and int(m[1]) < 24 and int(m[2]) < 60:
        at = time(int(m[1]), int(m[2]))
    elif m:  # не время (например, «10.12»): возвращаем текст назад
        t = text.strip()
        t = " " + t
    if at is None:
        m, t = _cut(r"\s(?:в|к|до)\s+(\d{1,2})\s*(?:час[а-яё]*|ч)(?![а-яё])", t)
        if m and int(m[1]) < 24:
            at = time(int(m[1]), 0)
    if at is None:
        for word, hh in (("утром", 9), ("днем", 13), ("днём", 13), ("вечером", 19)):
            m, t = _cut(rf"\s{word}(?![а-яё])", t)
            if m:
                at = time(hh, 0)
                break

    # --- дата ---
    m, t = _cut(r"\sчерез\s+(\d+|час|неделю)\s*(час[а-яё]*|ч(?![а-яё])|мин[а-яё]*|дн[а-яё]*|день|недел[а-яё]*)?", t)
    if m:
        n_raw, unit = m[1], (m[2] or "").lower()
        n = 1 if not n_raw.isdigit() else int(n_raw)
        if n_raw == "час":
            unit = "час"
        if n_raw == "неделю":
            unit = "недел"
        if unit.startswith("час") or unit == "ч":
            moment = now + timedelta(hours=n)
            due, at = moment.date(), time(moment.hour, 0)
        elif unit.startswith("мин"):
            moment = now + timedelta(minutes=n)
            due, at = moment.date(), time(moment.hour, moment.minute)
        elif unit.startswith("недел"):
            due = (now + timedelta(weeks=n)).date()
        else:
            due = (now + timedelta(days=n)).date()
    if due is None:
        for word, shift in (("послезавтра", 2), ("завтра", 1), ("сегодня", 0)):
            m, t = _cut(rf"\s{PREP}{word}", t)
            if m:
                due = (now + timedelta(days=shift)).date()
                break
    if due is None:  # «15 ноября»
        month_re = "|".join(MONTHS)
        m, t = _cut(rf"\s{PREP}(\d{{1,2}})\s+({month_re})[а-яё]*", t)
        if m:
            month = next(i for i, root in enumerate(MONTHS, 1) if re.match(root, m[2], re.IGNORECASE))
            year = now.year
            try:
                due = date(year, month, int(m[1]))
                if due < now.date():
                    due = date(year + 1, month, int(m[1]))
            except ValueError:
                due = None
    if due is None:
        for root, wd in WEEKDAYS:
            m, t = _cut(rf"\s{PREP}(?:следующ[а-яё]*\s+)?{root}[а-яё]*", t)
            if m:
                delta = (wd - now.weekday()) % 7 or 7  # ближайший будущий день недели
                due = (now + timedelta(days=delta)).date()
                break
    if due is None and at is not None:
        due = now.date()

    # --- название ---
    title = re.sub(r"\s+", " ", t).strip()
    title = re.sub(r"\s+(к|на|до|в|во|ко)$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"[\s,.;:—-]+$", "", title)
    title = (title[:1].upper() + title[1:]) if title else "Новая задача"

    return ParsedNote(title=title, due_date=due, due_time=at, tag=classify_tag(text))

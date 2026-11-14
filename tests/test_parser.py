from datetime import date, datetime, time

from app.nlp import parse_note

NOW = datetime(2026, 10, 23, 10, 0)  # пятница


def test_example_from_requirements():
    p = parse_note("Подготовить отчет по практике к пятнице 15:00", NOW)
    assert p.title == "Подготовить отчет по практике"
    assert p.due_date == date(2026, 10, 30)  # ближайшая будущая пятница
    assert p.due_time == time(15, 0)
    assert p.tag == "study"


def test_tomorrow_with_time():
    p = parse_note("Позвонить маме завтра в 19:00", NOW)
    assert p.title == "Позвонить маме"
    assert p.due_date == date(2026, 10, 24)
    assert p.due_time == time(19, 0)
    assert p.tag == "home"


def test_weekday_and_part_of_day():
    p = parse_note("Записаться к врачу в четверг утром", NOW)
    assert p.title == "Записаться к врачу"
    assert p.due_date == date(2026, 10, 29)
    assert p.due_time == time(9, 0)
    assert p.tag == "health"


def test_in_two_hours():
    p = parse_note("через 2 часа отправить письмо клиенту", NOW)
    assert p.title == "Отправить письмо клиенту"
    assert p.due_date == date(2026, 10, 23)
    assert p.due_time == time(12, 0)
    assert p.tag == "work"


def test_calendar_date():
    p = parse_note("Сдать реферат 15 ноября", NOW)
    assert p.due_date == date(2026, 11, 15)
    assert p.tag == "study"


def test_no_date():
    p = parse_note("Разобрать почту", NOW)
    assert p.due_date is None and p.due_time is None
    assert p.title == "Разобрать почту"

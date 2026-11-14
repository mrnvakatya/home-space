# Home space

Персональный ИИ-дашборд для задач: канбан-доска, календарь, таймер Pomodoro и «умная заметка».
Вы пишете мысль обычным русским языком, а приложение находит в ней суть задачи, дедлайн и тег и создаёт карточку.

> «Подготовить отчет по практике к пятнице 15:00» → задача «Подготовить отчет по практике», срок пт 15:00, тег «Учеба».

Стек: Python 3.11+, FastAPI, SQLAlchemy 2, SQLite (по умолчанию) или PostgreSQL, Jinja2 и чистый JavaScript на фронтенде (без сборки).

## Быстрый старт в PyCharm

1. **File → Open** и выберите папку `home-space`.
2. Создайте окружение: **Settings → Project → Python Interpreter → Add Interpreter → Add Local Interpreter → Virtualenv** (Python 3.11 или новее). PyCharm предложит поставить зависимости из `requirements.txt`. Если нет, откройте терминал PyCharm и выполните:
   ```bash
   pip install -r requirements.txt
   ```
3. Скопируйте `.env.example` в `.env` (можно оставить значения как есть для локальной разработки).
4. (По желанию) создайте демо-данные:
   ```bash
   python -m app.seed
   ```
   Вход: `demo@homespace.app` / `password123`.
5. Запуск. Создайте конфигурацию **Run → Edit Configurations → + → Python**:
   - тип запуска: **Module name** → `uvicorn`
   - параметры: `app.main:app --reload`
   - рабочая папка: корень проекта

   Или просто в терминале:
   ```bash
   uvicorn app.main:app --reload
   ```
6. Откройте http://127.0.0.1:8000. Документация API (Swagger): http://127.0.0.1:8000/docs.

Таблицы в базе создаются автоматически при первом запуске.

## Тесты

В PyCharm: правый клик по папке `tests` → **Run 'pytest in tests'**. Или в терминале:
```bash
pytest
```

## Загрузка в git

В терминале PyCharm (**Alt+F12**) из корня проекта:

```bash
git init
git add .
git commit -m "Первая версия Home space"
git branch -M main
git remote add origin https://github.com/<ваш-логин>/home-space.git
git push -u origin main
```

Сначала создайте пустой репозиторий на GitHub или GitLab без README. Файл `.gitignore` уже исключает `.env`, базу `*.db`, `.venv` и `.idea`, так что секреты и локальные данные в репозиторий не попадут. В репозиторий нужно коммитить `.env.example`, а не `.env`.

Через интерфейс PyCharm то же самое: **Git → Create Git Repository → Commit → Git → Manage Remotes → Push**.

## Структура

```
app/
  main.py            точка входа FastAPI, страницы / и /login
  config.py          настройки (.env)
  database.py        подключение к БД
  models.py          User, Task, FocusSession
  schemas.py         схемы запросов и ответов (pydantic)
  security.py        хеширование паролей
  deps.py            зависимости: сессия БД, текущий пользователь
  nlp/parser.py      разбор заметок: дата, время, тег, название
  routers/           auth, tasks (+ умная заметка), focus (Pomodoro и статистика)
  templates/         login.html, app.html
  static/            css/style.css, js/app.js
  seed.py            демо-данные
tests/               тесты парсера и API
```

## API

| Метод | Путь | Что делает |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | регистрация, вход, выход |
| GET | `/api/auth/me` | текущий пользователь |
| GET/POST | `/api/tasks` | список (`?archived=true` для архива), создание |
| PATCH/DELETE | `/api/tasks/{id}` | изменение (статус, тег, срок, архив), удаление |
| POST | `/api/notes/parse` | распознать заметку без сохранения |
| POST | `/api/notes` | распознать и сразу создать задачу |
| POST | `/api/focus/sessions` | записать сессию Pomodoro в задачу |
| GET | `/api/focus/stats?month=YYYY-MM` | минуты фокуса по дням и по задачам |

## Как работает NLP-модуль

`app/nlp/parser.py` — реализация на правилах: распознаёт «завтра», «послезавтра», «в четверг», «к пятнице», «через 2 часа», «15 ноября», «15:00», «утром», «вечером» и определяет тег по ключевым словам («Работа», «Учеба», «Быт», «Здоровье»). Функция `parse_note(text)` возвращает `ParsedNote`.

По концепции проекта позже можно заменить правила на BERT/NER-модель в отдельном сервисе FastAPI. Достаточно, чтобы `parse_note` возвращал тот же `ParsedNote`, остальной код менять не придётся.

## PostgreSQL

1. `pip install "psycopg[binary]"` (строка уже есть в `requirements.txt`, нужно её раскомментировать).
2. В `.env`: `DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/homespace`.
3. Для работы с изменением схемы в будущем добавьте Alembic. Сейчас таблицы создаются через `create_all`.

## Что дальше (по желанию)

- Голосовой ввод заметок.
- Повторяющиеся задачи и чек-листы.
- Alembic-миграции.
- Мобильная вёрстка основных экранов.

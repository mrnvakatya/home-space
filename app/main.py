from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from app.config import BASE_DIR, settings
from app.database import Base, engine
from app.deps import optional_user
from app.models import User
from app.routers import auth, focus, tasks


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # создаёт таблицы при первом запуске
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site="lax",
    max_age=60 * 60 * 24 * 30,
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(focus.router)


@app.get("/", include_in_schema=False)
def index(request: Request, user: User | None = Depends(optional_user)):
    if user is None:
        return RedirectResponse("/login")
    return templates.TemplateResponse(request, "app.html", {"user": user, "app_name": settings.app_name})


@app.get("/login", include_in_schema=False)
def login_page(request: Request, user: User | None = Depends(optional_user)):
    if user is not None:
        return RedirectResponse("/")
    return templates.TemplateResponse(request, "login.html", {"app_name": settings.app_name})

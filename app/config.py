"""Настройки приложения. Значения берутся из переменных окружения или файла .env."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # python-dotenv необязателен
    pass

BASE_DIR = Path(__file__).resolve().parent


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./homespace.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app_name: str = "Home space"


settings = Settings()

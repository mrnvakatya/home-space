import os
import tempfile

# База для тестов должна быть задана до импорта приложения
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_client(client):
    import uuid

    r = client.post("/api/auth/register", json={"email": f"{uuid.uuid4().hex[:8]}@mail.ru", "password": "password123", "name": "Катя"})
    assert r.status_code == 201
    return client

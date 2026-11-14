def test_requires_login(client):
    assert client.get("/api/tasks").status_code == 401


def test_register_login_logout(client):
    body = {"email": "a@b.ru", "password": "password123", "name": "А"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert client.post("/api/auth/register", json=body).status_code == 409
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@b.ru", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "a@b.ru", "password": "password123"}).status_code == 200
    assert client.get("/api/auth/me").json()["email"] == "a@b.ru"


def test_task_crud(auth_client):
    c = auth_client
    r = c.post("/api/tasks", json={"title": "Тест", "tag": "work", "due_date": "2026-10-30", "due_time": "15:00"})
    assert r.status_code == 201
    task = r.json()
    assert task["due_time"] == "15:00" and task["status"] == "todo"

    r = c.patch(f"/api/tasks/{task['id']}", json={"status": "doing", "title": "Новое"})
    assert r.json()["status"] == "doing" and r.json()["title"] == "Новое"

    r = c.patch(f"/api/tasks/{task['id']}", json={"due_date": None})
    assert r.json()["due_date"] is None

    assert len(c.get("/api/tasks").json()) == 1
    c.patch(f"/api/tasks/{task['id']}", json={"archived": True})
    assert c.get("/api/tasks").json() == []
    assert len(c.get("/api/tasks?archived=true").json()) == 1

    assert c.delete(f"/api/tasks/{task['id']}").status_code == 204
    assert c.get("/api/tasks?archived=true").json() == []


def test_tasks_are_private(client):
    client.post("/api/auth/register", json={"email": "u1@mail.ru", "password": "password123"})
    task = client.post("/api/tasks", json={"title": "Моя"}).json()
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"email": "u2@mail.ru", "password": "password123"})
    assert client.patch(f"/api/tasks/{task['id']}", json={"title": "Чужая"}).status_code == 404


def test_smart_note_and_focus(auth_client):
    c = auth_client
    r = c.post("/api/notes", json={"text": "Подготовить отчет по практике к пятнице 15:00"})
    assert r.status_code == 201
    task = r.json()
    assert task["title"] == "Подготовить отчет по практике"
    assert task["tag"] == "study" and task["due_time"] == "15:00"

    assert c.post("/api/focus/sessions", json={"task_id": task["id"], "minutes": 25}).status_code == 201
    assert c.get("/api/tasks").json()[0]["focus_minutes"] == 25
    stats = c.get("/api/focus/stats").json()
    assert stats["total"] == 25 and stats["by_task"][0]["minutes"] == 25

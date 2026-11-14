/* Home space: клиентская часть. Общается с FastAPI через /api/*. Без сборщиков и фреймворков. */
(() => {
  'use strict';

  // ---------- константы ----------
  const TAGS = {
    work: { name: 'Работа', color: '#9DB7D8', bg: 'rgba(157,183,216,.15)' },
    study: { name: 'Учеба', color: '#E39A8B', bg: 'rgba(217,139,124,.16)' },
    home: { name: 'Быт', color: '#CDBB9C', bg: 'rgba(205,187,156,.14)' },
    health: { name: 'Здоровье', color: '#BFC47C', bg: 'rgba(189,194,122,.15)' },
  };
  const STATUSES = [['todo', 'К выполнению'], ['doing', 'В процессе'], ['done', 'Выполнено']];
  const STATUS_NAME = Object.fromEntries(STATUSES);
  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const FOCUS_SEC = 25 * 60;
  const BREAK_SEC = 5 * 60;

  const ICONS = {
    board: '<rect x="3" y="3" width="7" height="18" rx="2"/><rect x="14" y="3" width="7" height="11" rx="2"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>',
    skip: '<path d="M6 5l9 7-9 7z M19 5v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
  };
  const ico = (n, s = 18) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  const cloud = (style) =>
    `<svg class="cloud" viewBox="0 0 140 60" aria-hidden="true" style="${style}"><g fill="#fff" fill-opacity=".62"><circle cx="40" cy="38" r="18"/><circle cx="66" cy="28" r="24"/><circle cx="96" cy="38" r="18"/><rect x="40" y="38" width="56" height="18" rx="9"/></g></svg>`;

  // ---------- утилиты ----------
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  const todayIso = () => iso(new Date());

  function fmtDate(date, time) {
    if (!date) return 'Без срока';
    const d = fromIso(date);
    const diff = Math.round((d - fromIso(todayIso())) / 86400000);
    const s = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    return time ? `${s} · ${time}` : s;
  }

  async function api(path, method = 'GET', body) {
    const r = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401) { location.href = '/login'; throw new Error('401'); }
    if (!r.ok) {
      let msg = 'Ошибка запроса';
      try { const d = await r.json(); if (typeof d.detail === 'string') msg = d.detail; } catch (_) {}
      throw new Error(msg);
    }
    return r.status === 204 ? null : r.json();
  }

  // ---------- состояние ----------
  const root = document.getElementById('root');
  const userName = root.dataset.userName || '';
  const S = {
    view: 'board',
    tasks: [],
    stats: { days: {}, total: 0, by_task: [] },
    noteText: '',
    parsed: null,
    busy: false,
    editor: null, // { id|null, title, description, tag, status, due_date, due_time, fromNote }
    cal: { mode: 'month', anchor: todayIso(), sel: todayIso() },
    pomo: { mode: 'focus', left: FOCUS_SEC, running: false, taskId: null, sessions: 0 },
    toast: '',
    dragId: 0,
  };
  let toastTimer = 0;

  const live = () => S.tasks.filter((t) => !t.archived);
  const byId = (id) => S.tasks.find((t) => t.id === Number(id));

  function showToast(msg) {
    S.toast = msg;
    render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2800);
  }

  async function loadTasks() { S.tasks = await api('/api/tasks'); }
  async function loadStats() {
    const m = todayIso().slice(0, 7);
    S.stats = await api(`/api/focus/stats?month=${m}`);
    const t = todayIso();
    S.pomo.sessions = Math.floor((S.stats.days[t] || 0) / 25);
  }
  async function refresh() { await Promise.all([loadTasks(), loadStats()]); render(); }

  // ---------- шаблоны ----------
  function tagLabel(tag) {
    const g = TAGS[tag];
    return `<span class="tag" style="color:${g.color}"><span class="dot" style="background:${g.color}"></span>${g.name}</span>`;
  }

  function sidebar() {
    const item = (v, label, icon) => `<button class="nav${S.view === v ? ' on' : ''}" data-act="view" data-view="${v}">${ico(icon, 20)}${label}</button>`;
    const initials = (userName.trim()[0] || '?').toUpperCase();
    return `
    <aside class="sidebar">
      <div class="brand"><span class="ring"><i></i></span><b>home space</b></div>
      <nav class="navlist" aria-label="Разделы">${item('board', 'Доска', 'board')}${item('calendar', 'Календарь', 'cal')}${item('focus', 'Фокус', 'timer')}</nav>
      <div class="user">
        <span class="avatar" aria-hidden="true">${esc(initials)}</span>
        <div class="userinfo"><span style="font-size:14px;font-weight:500">${esc(userName)}</span><button class="linkbtn" data-act="logout">Выйти</button></div>
      </div>
    </aside>`;
  }

  function header() {
    const d = new Date();
    const n = live().filter((t) => t.due_date === todayIso() && t.status !== 'done').length;
    const h = d.getHours();
    const hello = h < 5 ? 'доброй ночи' : h < 12 ? 'доброе утро' : h < 18 ? 'добрый день' : 'добрый вечер';
    const first = userName.split(/[\s@]/)[0].toLowerCase();
    return `
    <header class="head">
      <div class="col1">
        <span class="eyebrow ac">${WD_FULL[d.getDay()][0].toUpperCase() + WD_FULL[d.getDay()].slice(1)}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</span>
        <h1 class="display h1">${hello}, ${esc(first)}</h1>
      </div>
      <span class="sub">${n ? 'На сегодня задач: ' + n : 'На сегодня задач нет'}</span>
    </header>`;
  }

  function notePanel() {
    let extra = '';
    if (S.busy) {
      extra = `<div class="dots" style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px;min-height:44px"><span></span><span></span><span></span>Разбираю текст…</div>`;
    } else if (S.parsed) {
      const p = S.parsed, g = TAGS[p.tag];
      extra = `
      <div class="parsed">
        <div class="parsedgrid">
          <div><span class="eyebrow">Задача</span><strong>${esc(p.title)}</strong></div>
          <div><span class="eyebrow">Срок</span><strong>${esc(fmtDate(p.due_date, p.due_time))}</strong></div>
          <div><span class="eyebrow">Тег</span><strong><span class="dot" style="background:${g.color};width:10px;height:10px"></span>${g.name}</strong></div>
        </div>
        <div class="btns">
          <button class="btn" data-act="note-add">${ico('plus')}Добавить на доску</button>
          <button class="ghost" data-act="note-edit">Изменить</button>
          <button class="ghost" data-act="note-drop">Отмена</button>
        </div>
      </div>`;
    } else {
      const hint = (t) => `<button class="chipbtn" data-act="hint" data-text="${esc(t)}">${esc(t)}</button>`;
      extra = `<div class="hints"><small>Например:</small>${hint('Позвонить маме завтра в 19:00')}${hint('Записаться к врачу в четверг утром')}</div>`;
    }
    return `
    <section class="panel notepanel" aria-label="Умная заметка">
      <label for="note-input" class="eyebrow ac flex">${ico('spark', 16)}Умная заметка</label>
      <div class="noterow">
        <input id="note-input" class="noteinput" type="text" value="${esc(S.noteText)}" placeholder="Напишите мысль как есть: что, когда и зачем">
        <button class="btn" data-act="note-parse">Распознать</button>
      </div>
      ${extra}
    </section>`;
  }

  function pomoWidget() {
    const t = byId(S.pomo.taskId);
    const label = S.pomo.mode === 'focus' ? 'Фокус' : 'Отдых';
    return `
    <section class="dusk" aria-label="Pomodoro">
      ${cloud('right:14px;top:10px;width:140px;height:60px')}
      <span class="eyebrow js-pomo-label">${label}</span>
      <div class="bigtime js-pomo-time" style="font-size:84px;margin-top:18px">${mmss(S.pomo.left)}</div>
      <div class="tasktitle">${S.pomo.mode === 'break' ? 'Передохните, дальше снова фокус' : esc(t ? t.title : 'Выберите задачу')}</div>
      <div class="btnrow">
        <button class="cbtn js-pomo-btn" data-act="pomo-toggle">${S.pomo.running ? 'Пауза' : 'Старт'}</button>
        <button class="cround" aria-label="Сбросить таймер" data-act="pomo-reset">${ico('reset')}</button>
      </div>
      <button class="linkbtn" data-act="view" data-view="focus">Открыть большой таймер</button>
    </section>`;
  }

  function boardView() {
    const cols = STATUSES.map(([st, name]) => {
      const items = live().filter((t) => t.status === st);
      const cards = items.map((t) => `
        <div class="card${t.status === 'done' ? ' isdone' : ''}" draggable="true" data-drag="${t.id}">
          ${tagLabel(t.tag)}
          <button class="ct" data-act="edit" data-id="${t.id}">${esc(t.title)}</button>
          <div class="cardfoot">
            <span class="meta"><span>${ico('clock', 14)}${esc(fmtDate(t.due_date, t.due_time))}</span>${t.focus_minutes ? `<span>${ico('timer', 14)}${t.focus_minutes} мин</span>` : ''}</span>
            ${t.status !== 'done' ? `<button class="cplay" aria-label="Запустить таймер Pomodoro для этой задачи" data-act="play" data-id="${t.id}">${ico('play')}</button>` : ''}
          </div>
        </div>`).join('');
      return `
      <div class="col" data-drop="${st}">
        <div class="colhead"><h2>${name}</h2><span class="count">${items.length}</span></div>
        ${cards}
        <button class="addrow" data-act="new" data-status="${st}">${ico('plus', 16)}Добавить</button>
      </div>`;
    }).join('');

    const upcoming = live()
      .filter((t) => t.status !== 'done' && t.due_date)
      .sort((a, b) => (a.due_date + (a.due_time || '99:99')).localeCompare(b.due_date + (b.due_time || '99:99')))
      .slice(0, 5)
      .map((t) => `<button class="drow" data-act="edit" data-id="${t.id}"><span class="dot" style="background:${TAGS[t.tag].color}"></span><span class="t">${esc(t.title)}</span><small>${esc(fmtDate(t.due_date, ''))}</small></button>`)
      .join('') || '<p class="empty">Пока нет задач со сроком</p>';

    return `
    <div class="row">
      <section class="grow board" aria-label="Канбан-доска">${cols}</section>
      <aside class="side">
        ${pomoWidget()}
        <section class="panel pad upl" aria-label="Ближайшие сроки"><span class="eyebrow ac">Ближайшие сроки</span><div style="display:flex;flex-direction:column;gap:2px">${upcoming}</div></section>
      </aside>
    </div>`;
  }

  function calendarView() {
    const anchor = fromIso(S.cal.anchor);
    const isMonth = S.cal.mode === 'month';
    let start, count, title;
    if (isMonth) {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const off = (first.getDay() + 6) % 7;
      const dim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      start = new Date(first); start.setDate(1 - off);
      count = Math.ceil((off + dim) / 7) * 7;
      title = `${MONTHS[anchor.getMonth()].toLowerCase()} ${anchor.getFullYear()}`;
    } else {
      const off = (anchor.getDay() + 6) % 7;
      start = new Date(anchor); start.setDate(anchor.getDate() - off);
      count = 7;
      const end = new Date(start); end.setDate(start.getDate() + 6);
      title = `${start.getDate()} – ${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`;
    }
    const byDate = {};
    live().forEach((t) => { if (t.due_date) (byDate[t.due_date] = byDate[t.due_date] || []).push(t); });
    Object.values(byDate).forEach((l) => l.sort((a, b) => (a.due_time || '').localeCompare(b.due_time || '')));

    let cells = '';
    for (let i = 0; i < count; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = iso(d);
      const list = byDate[key] || [];
      const limit = isMonth ? 2 : 8;
      const out = isMonth && d.getMonth() !== anchor.getMonth();
      const pills = list.slice(0, limit).map((t) => `<span class="pill" style="background:${TAGS[t.tag].bg};color:${TAGS[t.tag].color}">${t.due_time ? t.due_time + ' ' : ''}${esc(t.title)}</span>`).join('');
      cells += `<button class="cell${key === S.cal.sel ? ' sel' : ''}${out ? ' out' : ''}" data-act="pick-day" data-day="${key}" style="min-height:${isMonth ? 104 : 320}px" aria-label="${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, задач: ${list.length}">
        <span class="num${key === todayIso() ? ' today' : ''}">${d.getDate()}</span>${pills}${list.length > limit ? `<span class="more">ещё ${list.length - limit}</span>` : ''}</button>`;
    }
    const sel = fromIso(S.cal.sel);
    const dayTasks = (byDate[S.cal.sel] || []).map((t) => `
      <button class="drow" data-act="edit" data-id="${t.id}"><span class="bar" style="background:${TAGS[t.tag].color}"></span>
        <span class="t"><b>${esc(t.title)}</b><small>${t.due_time ? t.due_time + ' · ' : ''}${TAGS[t.tag].name} · ${STATUS_NAME[t.status]}</small></span></button>`).join('');

    return `
    <div class="row">
      <section class="grow" style="display:flex;flex-direction:column;gap:16px" aria-label="Календарь">
        <div class="calhead">
          <h2 class="display">${title}</h2>
          <div class="calctl">
            <button class="seg${!isMonth ? ' on' : ''}" data-act="cal-mode" data-mode="week">Неделя</button>
            <button class="seg${isMonth ? ' on' : ''}" data-act="cal-mode" data-mode="month">Месяц</button>
            <button class="round" aria-label="Назад" data-act="cal-shift" data-dir="-1">${ico('left')}</button>
            <button class="ghost" data-act="cal-today">Сегодня</button>
            <button class="round" aria-label="Вперёд" data-act="cal-shift" data-dir="1">${ico('right')}</button>
          </div>
        </div>
        <div class="calbox"><div class="calin">
          <div class="wdrow">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => `<span class="eyebrow">${w}</span>`).join('')}</div>
          <div class="calgrid">${cells}</div>
        </div></div>
      </section>
      <aside class="panel pad side" style="padding:24px" aria-label="Выбранный день">
        <div class="dayhead">
          <div><span class="eyebrow ac">Выбранный день</span><h3 class="display">${WD_FULL[sel.getDay()]}, ${sel.getDate()} ${MONTHS_GEN[sel.getMonth()]}</h3></div>
          <button class="round" aria-label="Добавить задачу на этот день" data-act="new" data-status="todo" data-date="${S.cal.sel}" style="background:var(--accent);border-color:transparent;color:#14161B">${ico('plus')}</button>
        </div>
        ${dayTasks ? `<div class="daylist">${dayTasks}</div>` : '<p class="empty">На этот день задач нет.</p>'}
      </aside>
    </div>`;
  }

  function focusView() {
    const open = live().filter((t) => t.status !== 'done');
    const opts = open.map((t) => `<option value="${t.id}"${t.id === S.pomo.taskId ? ' selected' : ''}>${esc(t.title)}</option>`).join('');
    const dots = [0, 1, 2, 3].map((i) => `<i class="${i < S.pomo.sessions ? 'on' : ''}"></i>`).join('');

    // трекер: календарь из кружков с минутами фокуса за день
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let trk = '<div class="trk off"></div>'.repeat((first.getDay() + 6) % 7);
    for (let d = 1; d <= dim; d++) {
      const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(d)}`;
      const m = S.stats.days[key] || 0;
      trk += `<div class="trk${m ? '' : ' empty'}${key === todayIso() ? ' today' : ''}"><span class="n">${d}</span><span class="v">${m || ''}</span></div>`;
    }
    const total = S.stats.total || 0;
    const rows = S.stats.by_task.map((r) => `<div class="focusrow"><span>${esc(r.title)}</span><span>${r.minutes} мин</span></div>`).join('') || '<p class="empty">Пока нет записанных сессий</p>';

    return `
    <div class="row" style="align-items:stretch">
      <section class="grow dusk focusbox" aria-label="Таймер">
        ${cloud('right:28px;top:22px;width:170px;height:73px')}${cloud('left:20px;bottom:28px;width:120px;height:51px;opacity:.8')}
        <span class="eyebrow js-pomo-label">${S.pomo.mode === 'focus' ? 'Фокус' : 'Отдых'}</span>
        <div class="ringwrap">
          <svg viewBox="0 0 320 320" aria-hidden="true">
            <circle cx="160" cy="160" r="140" fill="none" stroke="rgba(20,22,27,.14)" stroke-width="5"/>
            <circle class="js-ring" cx="160" cy="160" r="140" fill="none" stroke="#14161B" stroke-width="5" stroke-linecap="round" stroke-dasharray="880 880" transform="rotate(-90 160 160)"/>
          </svg>
          <div class="bigtime js-pomo-time">${mmss(S.pomo.left)}</div>
        </div>
        <div class="selwrap">
          <label for="pomo-task" class="eyebrow">Над чем работаем</label>
          <select id="pomo-task" class="field">${opts || '<option value="">Нет открытых задач</option>'}</select>
        </div>
        <div class="ctrls">
          <button class="cround" aria-label="Сбросить таймер" data-act="pomo-reset">${ico('reset')}</button>
          <button class="cbtn js-pomo-btn" data-act="pomo-toggle">${S.pomo.running ? 'Пауза' : 'Старт'}</button>
          <button class="cround" aria-label="Завершить текущий отрезок" data-act="pomo-skip">${ico('skip')}</button>
        </div>
        <div class="sessions">${dots}<span style="margin-left:8px">${S.pomo.sessions} из 4 · 25 минут фокуса, затем 5 отдыха</span></div>
      </section>
      <aside class="side" aria-label="Статистика фокуса">
        <section class="panel pad">
          <div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow ac">Трекер фокуса</span><span class="display" style="font-size:28px;line-height:1.05">${MONTHS[now.getMonth()].toLowerCase()} · ${Math.floor(total / 60)} ч ${total % 60} мин</span></div>
          <div class="trkgrid">${trk}</div>
          <span style="font-size:12.5px;color:var(--muted)">В кружках минуты фокуса за день</span>
        </section>
        <section class="panel pad"><span class="eyebrow ac">Время по задачам</span>${rows}</section>
      </aside>
    </div>`;
  }

  function editorModal() {
    const e = S.editor;
    if (!e) return '';
    const statuses = STATUSES.map(([k, n]) => `<button class="seg${e.status === k ? ' on' : ''}" data-act="ed-set" data-field="status" data-value="${k}">${n}</button>`).join('');
    const tags = Object.entries(TAGS).map(([k, g]) => `<button class="seg${e.tag === k ? ' on' : ''}" data-act="ed-set" data-field="tag" data-value="${k}"><span class="dot" style="background:${g.color}"></span>${g.name}</button>`).join('');
    return `
    <div class="modalback"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ed-title">
      <div class="mh"><h2 id="ed-title" class="display">${e.id ? 'задача' : 'новая задача'}</h2><button class="round" aria-label="Закрыть" data-act="ed-close">${ico('close')}</button></div>
      <div class="fld"><label for="ed-name" class="eyebrow">Название</label><input id="ed-name" class="field" type="text" data-bind="title" value="${esc(e.title)}"></div>
      <div class="fld"><label for="ed-desc" class="eyebrow">Описание</label><textarea id="ed-desc" class="field" rows="3" data-bind="description" placeholder="Необязательно" style="resize:vertical">${esc(e.description)}</textarea></div>
      <div class="two">
        <div class="fld"><label for="ed-date" class="eyebrow">Дедлайн</label><input id="ed-date" class="field" type="date" data-bind="due_date" value="${esc(e.due_date || '')}"></div>
        <div class="fld"><label for="ed-time" class="eyebrow">Время</label><input id="ed-time" class="field" type="time" data-bind="due_time" value="${esc(e.due_time || '')}"></div>
      </div>
      <div class="fld"><span class="eyebrow">Статус</span><div class="chips">${statuses}</div></div>
      <div class="fld"><span class="eyebrow">Тег</span><div class="chips">${tags}</div></div>
      <div class="mfoot">
        ${e.id ? `<button class="ghost danger" data-act="ed-delete">${ico('trash', 16)}Удалить</button><button class="ghost" data-act="ed-archive">${ico('archive', 16)}В архив</button>` : ''}
        <span class="sp"></span>
        <button class="btn" data-act="ed-save">${e.id ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </div></div>`;
  }

  function render() {
    const active = document.activeElement;
    const keepNote = active && active.id === 'note-input';
    const caret = keepNote ? active.selectionStart : 0;
    const view = S.view === 'board' ? boardView() : S.view === 'calendar' ? calendarView() : focusView();
    root.innerHTML = `
    <div class="app">
      ${sidebar()}
      <main class="main">${header()}${notePanel()}${view}</main>
    </div>
    ${editorModal()}
    ${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}`;
    if (keepNote) {
      const el = document.getElementById('note-input');
      el.focus();
      el.setSelectionRange(caret, caret);
    }
    updatePomoDom();
  }

  // ---------- Pomodoro ----------
  function updatePomoDom() {
    const total = S.pomo.mode === 'focus' ? FOCUS_SEC : BREAK_SEC;
    document.querySelectorAll('.js-pomo-time').forEach((el) => { el.textContent = mmss(S.pomo.left); });
    document.querySelectorAll('.js-pomo-btn').forEach((el) => { el.textContent = S.pomo.running ? 'Пауза' : 'Старт'; });
    document.querySelectorAll('.js-pomo-label').forEach((el) => { el.textContent = S.pomo.mode === 'focus' ? 'Фокус' : 'Отдых'; });
    const ring = document.querySelector('.js-ring');
    if (ring) {
      const c = 2 * Math.PI * 140;
      ring.setAttribute('stroke-dasharray', `${(c * S.pomo.left / total).toFixed(1)} ${c.toFixed(1)}`);
      ring.setAttribute('stroke', S.pomo.mode === 'focus' ? '#14161B' : '#44633A');
    }
  }

  async function finishPomo(natural) {
    const p = S.pomo;
    if (p.mode === 'focus') {
      const minutes = natural ? 25 : Math.ceil((FOCUS_SEC - p.left) / 60);
      if (minutes > 0 && p.taskId) {
        try {
          await api('/api/focus/sessions', 'POST', { task_id: p.taskId, minutes });
          await loadTasks();
          await loadStats();
        } catch (err) { showToast(err.message); }
      }
      p.mode = 'break'; p.left = BREAK_SEC; p.running = true;
      render();
      showToast(natural ? 'Сессия завершена. Начинается отдых 5 минут' : 'Время записано в карточку задачи');
    } else {
      p.mode = 'focus'; p.left = FOCUS_SEC; p.running = false;
      render();
    }
  }

  setInterval(() => {
    const p = S.pomo;
    if (!p.running) return;
    if (p.left <= 1) { p.left = 0; updatePomoDom(); finishPomo(true); return; }
    p.left -= 1;
    updatePomoDom();
  }, 1000);

  function ensurePomoTask() {
    if (!byId(S.pomo.taskId)) {
      const first = live().find((t) => t.status !== 'done');
      S.pomo.taskId = first ? first.id : null;
    }
    return S.pomo.taskId;
  }

  // ---------- действия ----------
  function openEditor(task, extra = {}) {
    S.editor = task
      ? { id: task.id, title: task.title, description: task.description, tag: task.tag, status: task.status, due_date: task.due_date, due_time: task.due_time }
      : { id: null, title: '', description: '', tag: 'work', status: 'todo', due_date: null, due_time: null, ...extra };
    render();
  }

  async function saveEditor() {
    const e = S.editor;
    const title = e.title.trim();
    if (!title) { showToast('Введите название задачи'); return; }
    const payload = {
      title, description: e.description, tag: e.tag, status: e.status,
      due_date: e.due_date || null, due_time: e.due_time || null,
    };
    try {
      if (e.id) await api(`/api/tasks/${e.id}`, 'PATCH', payload);
      else await api('/api/tasks', 'POST', payload);
      if (e.fromNote) { S.parsed = null; S.noteText = ''; }
      S.editor = null;
      await loadTasks();
      render();
      showToast(e.id ? 'Изменения сохранены' : 'Задача добавлена на доску и в календарь');
    } catch (err) { showToast(err.message); }
  }

  async function parseNote() {
    const text = S.noteText.trim();
    if (!text) return;
    S.busy = true; S.parsed = null; render();
    try {
      S.parsed = await api('/api/notes/parse', 'POST', { text });
    } catch (err) { showToast(err.message); }
    S.busy = false;
    render();
  }

  async function addParsed() {
    const p = S.parsed;
    try {
      await api('/api/tasks', 'POST', { title: p.title, tag: p.tag, due_date: p.due_date, due_time: p.due_time });
      S.parsed = null; S.noteText = '';
      await loadTasks(); render();
      showToast('Задача добавлена на доску и в календарь');
    } catch (err) { showToast(err.message); }
  }

  async function moveTask(id, status) {
    const t = byId(id);
    if (!t || t.status === status) return;
    t.status = status; render(); // оптимистично
    try { await api(`/api/tasks/${id}`, 'PATCH', { status }); } catch (err) { showToast(err.message); await loadTasks(); render(); }
  }

  const actions = {
    view: (d) => { S.view = d.view; if (d.view === 'focus') { ensurePomoTask(); loadStats().then(render); } render(); },
    logout: async () => { await api('/api/auth/logout', 'POST'); location.href = '/login'; },
    hint: (d) => { S.noteText = d.text; S.parsed = null; render(); },
    'note-parse': parseNote,
    'note-add': addParsed,
    'note-edit': () => openEditor(null, {
      title: S.parsed.title, tag: S.parsed.tag, due_date: S.parsed.due_date, due_time: S.parsed.due_time, fromNote: true,
    }),
    'note-drop': () => { S.parsed = null; render(); },
    edit: (d) => openEditor(byId(d.id)),
    new: (d) => openEditor(null, { status: d.status || 'todo', due_date: d.date || null }),
    play: (d) => { S.pomo = { ...S.pomo, taskId: Number(d.id), mode: 'focus', left: FOCUS_SEC, running: true }; S.view = 'focus'; loadStats().then(render); render(); },
    'ed-close': () => { S.editor = null; render(); },
    'ed-set': (d) => { S.editor[d.field] = d.value; render(); },
    'ed-save': saveEditor,
    'ed-delete': async () => {
      try { await api(`/api/tasks/${S.editor.id}`, 'DELETE'); S.editor = null; await loadTasks(); render(); showToast('Задача удалена'); } catch (err) { showToast(err.message); }
    },
    'ed-archive': async () => {
      try { await api(`/api/tasks/${S.editor.id}`, 'PATCH', { archived: true }); S.editor = null; await loadTasks(); render(); showToast('Задача перенесена в архив'); } catch (err) { showToast(err.message); }
    },
    'cal-mode': (d) => { S.cal.mode = d.mode; render(); },
    'cal-today': () => { S.cal.anchor = S.cal.sel = todayIso(); render(); },
    'cal-shift': (d) => {
      const a = fromIso(S.cal.anchor), dir = Number(d.dir);
      if (S.cal.mode === 'month') a.setMonth(a.getMonth() + dir, 1); else a.setDate(a.getDate() + 7 * dir);
      S.cal.anchor = iso(a); render();
    },
    'pick-day': (d) => { S.cal.sel = d.day; render(); },
    'pomo-toggle': () => {
      if (!S.pomo.running && S.pomo.mode === 'focus' && !ensurePomoTask()) { showToast('Сначала создайте задачу'); return; }
      S.pomo.running = !S.pomo.running; updatePomoDom();
    },
    'pomo-reset': () => { S.pomo = { ...S.pomo, running: false, mode: 'focus', left: FOCUS_SEC }; render(); },
    'pomo-skip': () => finishPomo(false),
  };

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !actions[el.dataset.act]) return;
    actions[el.dataset.act](el.dataset);
  });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'note-input') { S.noteText = t.value; S.parsed = null; return; }
    if (t.dataset.bind && S.editor) S.editor[t.dataset.bind] = t.value;
  });

  root.addEventListener('change', (e) => {
    if (e.target.id === 'pomo-task') { S.pomo.taskId = Number(e.target.value) || null; }
  });

  root.addEventListener('keydown', (e) => {
    if (e.target.id === 'note-input' && e.key === 'Enter') { e.preventDefault(); parseNote(); }
    if (e.key === 'Escape' && S.editor) { S.editor = null; render(); }
  });

  // drag & drop карточек между колонками
  root.addEventListener('dragstart', (e) => {
    const c = e.target.closest('[data-drag]');
    if (!c) return;
    S.dragId = Number(c.dataset.drag);
    e.dataTransfer.setData('text/plain', String(S.dragId));
    e.dataTransfer.effectAllowed = 'move';
  });
  root.addEventListener('dragover', (e) => { if (e.target.closest('[data-drop]')) e.preventDefault(); });
  root.addEventListener('drop', (e) => {
    const col = e.target.closest('[data-drop]');
    if (!col || !S.dragId) return;
    e.preventDefault();
    const id = S.dragId; S.dragId = 0;
    moveTask(id, col.dataset.drop);
  });

  // ---------- старт ----------
  refresh().catch((err) => { if (err.message !== '401') root.textContent = 'Не удалось загрузить данные: ' + err.message; });
})();

(() => {
  'use strict';

  const STORAGE_KEY = 'kisisel-merkez-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const view = $('#app-view');
  const sheetBackdrop = $('#sheet-backdrop');
  const sheetContent = $('#sheet-content');
  const sheetTitle = $('#sheet-title');
  const sheetKicker = $('#sheet-kicker');
  const quickMenu = $('#quick-menu');
  const fab = $('#fab');
  const toast = $('#toast');
  let toastTimer;
  let currentRoute = 'today';
  let planTab = 'tasks';
  let calendarCursor = startOfMonth(new Date());
  let selectedCalendarDate = todayISO();

  function pad(value) { return String(value).padStart(2, '0'); }
  function toISO(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function todayISO() { return toISO(new Date()); }
  function parseISO(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(value, amount) { const date = typeof value === 'string' ? parseISO(value) : new Date(value); date.setDate(date.getDate() + amount); return toISO(date); }
  function startOfMonth(value) { return new Date(value.getFullYear(), value.getMonth(), 1); }
  function startOfWeek(value = new Date()) { const date = new Date(value); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); date.setHours(0, 0, 0, 0); return date; }
  function id() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function esc(value = '') { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function money(value) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function shortDate(value) { return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(parseISO(value)); }
  function longDate(value) { return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(parseISO(value)); }
  function monthLabel(date) { return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(date).replace(/^./, x => x.toUpperCase()); }
  function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'; }

  function defaultState() {
    const today = todayISO();
    return {
      version: 1,
      profile: { name: 'Tolga' },
      settings: { theme: 'auto', monthlyBudget: 20000, startingSavings: 0, savingsTarget: 100000, bedtime: '23:30', wakeTime: '07:00', notifications: false },
      tasks: [
        { id: id(), title: 'Bu haftanın 3 önceliğini belirle', date: today, time: '09:00', priority: true, done: false, notes: '' },
        { id: id(), title: 'Kişisel Merkez’i ana ekrana ekle', date: today, time: '20:00', priority: false, done: false, notes: 'Safari’de Paylaş → Ana Ekrana Ekle' }
      ],
      workouts: [
        { id: id(), title: 'Üst vücut', date: today, time: '18:30', duration: 45, exercises: 'Şınav — 4×10\nRow — 4×10\nOmuz press — 3×12\nBiceps curl — 3×12', exerciseItems: [{ id: id(), name: 'Şınav — 4×10', done: false }, { id: id(), name: 'Row — 4×10', done: false }, { id: id(), name: 'Omuz press — 3×12', done: false }, { id: id(), name: 'Biceps curl — 3×12', done: false }], done: false },
        { id: id(), title: 'Alt vücut', date: addDays(today, 2), time: '18:30', duration: 45, exercises: 'Squat — 4×10\nLunge — 3×10\nHip hinge — 4×8\nCalf raise — 3×15', exerciseItems: [{ id: id(), name: 'Squat — 4×10', done: false }, { id: id(), name: 'Lunge — 3×10', done: false }, { id: id(), name: 'Hip hinge — 4×8', done: false }, { id: id(), name: 'Calf raise — 3×15', done: false }], done: false }
      ],
      expenses: [],
      incomes: [],
      recurringExpenses: [],
      sleepEntries: [],
      routine: [
        { id: id(), title: 'Ekranları bırak', time: '22:45' },
        { id: id(), title: 'Yarın için 3 öncelik seç', time: '23:00' },
        { id: id(), title: 'Odayı hazırla', time: '23:15' }
      ],
      routineLogs: {},
      weeklyReviews: [],
      notified: {}
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === 1) return { ...defaultState(), ...saved, settings: { ...defaultState().settings, ...saved.settings } };
    } catch (error) { console.warn('Kayıt okunamadı', error); }
    return defaultState();
  }

  let state = loadState();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showToast('Kayıt yapılamadı. Yedek alıp tekrar dene.'); }
  }

  function migrateWorkoutDetails() {
    let changed = false;
    const presets = {
      'Şınav, row, omuz press, curl': ['Şınav — 4×10', 'Row — 4×10', 'Omuz press — 3×12', 'Biceps curl — 3×12'],
      'Squat, lunge, hip hinge, calf raise': ['Squat — 4×10', 'Lunge — 3×10', 'Hip hinge — 4×8', 'Calf raise — 3×15']
    };
    state.workouts.forEach(workout => {
      if (Array.isArray(workout.exerciseItems)) return;
      const names = presets[workout.exercises] || String(workout.exercises || '').split(/\r?\n|,/).map(name => name.trim()).filter(Boolean);
      workout.exerciseItems = names.map(name => ({ id: id(), name, done: false }));
      workout.exercises = names.join('\n');
      changed = true;
    });
    if (changed) save();
  }

  migrateWorkoutDetails();

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  function applyTheme() {
    document.documentElement.style.colorScheme = state.settings.theme === 'auto' ? 'light dark' : state.settings.theme;
    const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').content = dark ? '#0b1018' : '#eef2f8';
  }

  function openSheet(kicker, title, html, ready) {
    sheetKicker.textContent = kicker;
    sheetTitle.textContent = title;
    sheetContent.innerHTML = html;
    sheetBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('input, textarea, select, button', sheetContent)?.focus(), 30);
    if (ready) ready(sheetContent);
  }

  function closeSheet() {
    sheetBackdrop.hidden = true;
    document.body.style.overflow = '';
    sheetContent.innerHTML = '';
  }

  function setRoute(route) {
    currentRoute = route;
    $$('[data-route]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.route === route)));
    quickMenu.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    render();
    view.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setHeader(eyebrow, title) {
    $('#header-eyebrow').textContent = eyebrow;
    $('#header-title').textContent = title;
    $('#avatar-letter').textContent = (state.profile.name || 'K').trim().charAt(0).toUpperCase();
  }

  function render() {
    if (currentRoute === 'today') renderToday();
    if (currentRoute === 'calendar') renderCalendar();
    if (currentRoute === 'plans') renderPlans();
    if (currentRoute === 'progress') renderProgress();
  }

  function todayItems() {
    const today = todayISO();
    return {
      tasks: state.tasks.filter(item => item.date === today).sort((a, b) => `${!a.priority}${a.time}`.localeCompare(`${!b.priority}${b.time}`)),
      workouts: state.workouts.filter(item => item.date === today).sort((a, b) => a.time.localeCompare(b.time)),
      sleep: state.sleepEntries.find(item => item.date === addDays(today, -1)) || null,
      expenses: state.expenses.filter(item => item.date === today)
    };
  }

  function renderToday() {
    const items = todayItems();
    const priorities = items.tasks.filter(item => item.priority).slice(0, 3);
    const focus = priorities.find(item => !item.done) || items.tasks.find(item => !item.done);
    const doneCount = priorities.filter(item => item.done).length;
    const todaySpend = items.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const dailyLimit = Number(state.settings.monthlyBudget || 0) / 30;
    const routineDone = state.routineLogs[todayISO()] || [];
    setHeader(new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date()), `${greeting()}, ${state.profile.name}`);

    view.innerHTML = `<div class="stack">
      ${focus ? `<article class="focus-card ${focus.done ? 'is-done' : ''}">
        <div class="focus-top"><span>GÜNÜN ODAĞI</span><span>${doneCount} / ${Math.max(priorities.length, 1)} tamamlandı</span></div>
        <div class="focus-title">${esc(focus.title)}</div>
        <div class="focus-note">${esc(focus.time || 'Saat yok')}${focus.notes ? ` · ${esc(focus.notes)}` : ''}</div>
        <div class="focus-actions">
          <button class="button" type="button" data-toggle-task="${focus.id}">${focus.done ? 'Geri al' : 'Tamamla'}</button>
          <button class="button" type="button" data-edit-task="${focus.id}">Düzenle</button>
        </div>
      </article>` : `<article class="focus-card"><div class="focus-top"><span>GÜNÜN ODAĞI</span><span>0 / 3</span></div><div class="focus-title">Bugünün odağını seç</div><div class="focus-note">En fazla üç önemli iş ekle.</div><div class="focus-actions"><button class="button" type="button" data-add="task">Öncelik ekle</button></div></article>`}

      <div class="section-label">Bugünün planı</div>
      ${items.tasks.length ? items.tasks.map(taskCard).join('') : emptyInline('✓', 'Bugün görev yok', 'Hızlıca bir öncelik ekleyebilirsin.', 'Görev ekle', 'task')}

      ${items.workouts.length ? items.workouts.map(workoutCard).join('') : `<article class="card"><div class="row"><div class="module-icon">↗</div><div class="grow"><p class="item-title">Bugün spor planı yok</p><p class="item-detail">Dinlenme günü olabilir.</p></div><button class="button" type="button" data-add="workout">Planla</button></div></article>`}

      <article class="card">
        <div class="row between">
          <div class="row grow"><div class="module-icon">☾</div><div class="grow"><p class="item-title">Uyku hazırlığı</p><p class="item-detail">${esc(state.settings.bedtime)} yatış hedefi · ${routineDone.length} / ${state.routine.length} adım</p></div></div>
          <button class="button" type="button" data-open-routine>Rutini aç</button>
        </div>
        <div class="progress-track"><span style="width:${state.routine.length ? (routineDone.length / state.routine.length) * 100 : 0}%"></span></div>
      </article>

      <article class="card">
        <div class="row between">
          <div class="row grow"><div class="module-icon">₺</div><div class="grow"><p class="item-title">Bugünkü harcama</p><p class="item-detail">${money(todaySpend)} · günlük ortalama sınır ${money(dailyLimit)}</p></div></div>
          <button class="button" type="button" data-add="expense">Ekle</button>
        </div>
        <div class="progress-track ${todaySpend > dailyLimit ? 'warn' : 'good'}"><span style="width:${clamp(dailyLimit ? todaySpend / dailyLimit * 100 : 0, 0, 100)}%"></span></div>
      </article>
    </div>`;
  }

  function taskCard(item) {
    return `<article class="card ${item.done ? 'is-done' : ''}"><div class="row">
      <button class="check-button ${item.done ? 'done' : ''}" type="button" data-toggle-task="${item.id}" aria-label="${item.done ? 'Tamamlanmadı yap' : 'Tamamla'}">✓</button>
      <div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${esc(item.time || 'Saat yok')}${item.priority ? ' · Öncelik' : ''}</p></div>
      <button class="icon-button" type="button" data-edit-task="${item.id}" aria-label="Görevi düzenle">···</button>
    </div></article>`;
  }

  function workoutCard(item) {
    const exercises = workoutExercises(item);
    const completed = exercises.filter(x => x.done).length;
    return `<article class="card ${item.done ? 'is-done' : ''}"><div class="row">
      <div class="module-icon">↗</div><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${esc(item.time)} · ${item.duration} dk · ${completed}/${exercises.length} hareket</p></div>
      <button class="button ${item.done ? 'good' : ''}" type="button" data-workout-detail="${item.id}">${item.done ? 'Tamamlandı' : 'Detay'}</button>
    </div>${exercises.length ? `<div class="progress-track good"><span style="width:${completed / exercises.length * 100}%"></span></div>` : ''}</article>`;
  }

  function workoutExercises(item) {
    if (Array.isArray(item.exerciseItems)) return item.exerciseItems;
    return String(item.exercises || '').split(/\r?\n|,/).map(name => name.trim()).filter(Boolean).map(name => ({ id: id(), name, done: false }));
  }

  function ensureWorkoutExercises(item) {
    if (!Array.isArray(item.exerciseItems)) item.exerciseItems = workoutExercises(item);
    return item.exerciseItems;
  }

  function emptyInline(icon, title, copy, button, type) {
    return `<article class="card empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${copy}</p><button class="button" type="button" data-add="${type}">${button}</button></article>`;
  }

  function entriesForDate(date) {
    const entries = [];
    state.tasks.filter(x => x.date === date).forEach(x => entries.push({ time: x.time || '—', title: x.title, note: x.done ? 'Görev · Tamamlandı' : 'Görev' }));
    state.workouts.filter(x => x.date === date).forEach(x => entries.push({ time: x.time || '—', title: x.title, note: `Spor · ${x.duration} dakika${x.done ? ' · Tamamlandı' : ''}` }));
    state.expenses.filter(x => x.date === date).forEach(x => entries.push({ time: '₺', title: x.note || x.category, note: `${money(x.amount)} · ${x.category}` }));
    state.incomes.filter(x => x.date === date).forEach(x => entries.push({ time: '+', title: x.note || x.source, note: `${money(x.amount)} gelir · ${x.source}` }));
    return entries.sort((a, b) => a.time.localeCompare(b.time));
  }

  function renderCalendar() {
    setHeader('Tüm planların', 'Takvim');
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, month + 1, 0).getDate();
    let days = '<span class="calendar-blank"></span>'.repeat(firstDay);
    for (let day = 1; day <= dayCount; day++) {
      const iso = toISO(new Date(year, month, day));
      const hasItems = entriesForDate(iso).length > 0;
      days += `<button class="calendar-day ${hasItems ? 'has-items' : ''} ${iso === todayISO() ? 'today' : ''} ${iso === selectedCalendarDate ? 'selected' : ''}" type="button" data-calendar-date="${iso}">${day}</button>`;
    }
    const agenda = entriesForDate(selectedCalendarDate);
    view.innerHTML = `<div class="stack">
      <div class="calendar-header"><div class="calendar-title">${monthLabel(calendarCursor)}</div><div class="calendar-actions"><button class="icon-button" type="button" data-month="-1" aria-label="Önceki ay">‹</button><button class="icon-button" type="button" data-month="1" aria-label="Sonraki ay">›</button></div></div>
      <div class="weekdays"><span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span>Cmt</span><span>Paz</span></div>
      <div class="calendar-grid">${days}</div>
      <div class="row between"><div class="section-label">${esc(longDate(selectedCalendarDate))}</div><button class="button" type="button" data-add="task" data-date="${selectedCalendarDate}">+ Ekle</button></div>
      <ul class="list">${agenda.length ? agenda.map(item => `<li class="list-item"><span class="agenda-time">${esc(item.time)}</span><span class="grow"><span class="item-title">${esc(item.title)}</span><br><span class="item-detail">${esc(item.note)}</span></span></li>`).join('') : `<li class="card empty-state"><div class="empty-icon">○</div><h3>Bu gün boş</h3><p>Plan eklemek için “Ekle”ye dokun.</p></li>`}</ul>
    </div>`;
  }

  function renderPlans() {
    setHeader('Düzenini kur', 'Planlar');
    const tabs = `<div class="segmented"><button class="${planTab === 'tasks' ? 'selected' : ''}" data-plan-tab="tasks">Görev</button><button class="${planTab === 'workouts' ? 'selected' : ''}" data-plan-tab="workouts">Spor</button><button class="${planTab === 'sleep' ? 'selected' : ''}" data-plan-tab="sleep">Uyku</button><button class="${planTab === 'budget' ? 'selected' : ''}" data-plan-tab="budget">Bütçe</button></div>`;
    let content = '';
    if (planTab === 'tasks') content = renderTaskPlan();
    if (planTab === 'workouts') content = renderWorkoutPlan();
    if (planTab === 'sleep') content = renderSleepPlan();
    if (planTab === 'budget') content = renderBudgetPlan();
    view.innerHTML = `<div class="stack">${tabs}${content}</div>`;
  }

  function renderTaskPlan() {
    const items = [...state.tasks].sort((a, b) => `${a.done}${a.date}${a.time}`.localeCompare(`${b.done}${b.date}${b.time}`));
    return `<div class="row between"><div class="section-label">Görevler ve hedefler</div><button class="button" type="button" data-add="task">+ Görev</button></div>
      ${items.length ? items.map(item => `<article class="card ${item.done ? 'is-done' : ''}"><div class="row"><button class="check-button ${item.done ? 'done' : ''}" type="button" data-toggle-task="${item.id}">✓</button><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.time || 'Saat yok')}${item.priority ? ' · Öncelik' : ''}</p></div><button class="icon-button" type="button" data-edit-task="${item.id}">···</button></div></article>`).join('') : emptyInline('✓', 'Görev listesi boş', 'İlk hedefini ya da yapman gereken işi ekle.', 'Görev ekle', 'task')}`;
  }

  function renderWorkoutPlan() {
    const items = [...state.workouts].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    return `<div class="row between"><div class="section-label">Spor programı</div><button class="button" type="button" data-add="workout">+ Antrenman</button></div>
      ${items.length ? items.map(item => { const exercises = workoutExercises(item); const completed = exercises.filter(x => x.done).length; return `<article class="card ${item.done ? 'is-done' : ''}"><div class="row"><div class="module-icon">↗</div><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.time)} · ${item.duration} dk · ${completed}/${exercises.length} hareket</p></div><button class="button ${item.done ? 'good' : ''}" type="button" data-workout-detail="${item.id}">${item.done ? 'Bitti' : 'Detay'}</button><button class="icon-button" type="button" data-edit-workout="${item.id}">···</button></div>${exercises.length ? `<div class="progress-track good"><span style="width:${completed / exercises.length * 100}%"></span></div>` : ''}</article>`; }).join('') : emptyInline('↗', 'Program boş', 'İlk antrenmanını tarih ve saatle planla.', 'Antrenman ekle', 'workout')}`;
  }

  function renderSleepPlan() {
    const recent = [...state.sleepEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const avg = average(recent.map(x => x.duration));
    return `<article class="card"><div class="row between"><div><p class="item-title">Uyku hedefi</p><p class="item-detail">${esc(state.settings.bedtime)} – ${esc(state.settings.wakeTime)}</p></div><button class="button" type="button" data-settings-sleep>Düzenle</button></div></article>
      <div class="mini-grid"><div class="stat-card"><div class="stat-label">Son 7 kayıt</div><div class="stat-value">${formatDuration(avg)}</div><div class="stat-note">Ortalama süre</div></div><div class="stat-card"><div class="stat-label">Enerji</div><div class="stat-value">${recent.length ? `${average(recent.map(x => Number(x.energy))).toFixed(1)} / 5` : '—'}</div><div class="stat-note">Sabah hissi</div></div></div>
      <div class="row between"><div class="section-label">Uyku kayıtları</div><button class="button" type="button" data-add="sleep">+ Kaydet</button></div>
      ${recent.length ? recent.map(item => `<article class="card"><div class="row"><div class="module-icon">☾</div><div class="grow"><p class="item-title">${shortDate(item.date)} · ${formatDuration(item.duration)}</p><p class="item-detail">${esc(item.bedTime)} – ${esc(item.wakeTime)} · Enerji ${item.energy}/5 · Kalite ${item.quality}/5</p></div><button class="icon-button" type="button" data-edit-sleep="${item.id}">···</button></div></article>`).join('') : emptyInline('☾', 'Henüz uyku kaydı yok', 'Saatleri ve sabah enerjini gir; düzenini birlikte görelim.', 'İlk kaydı ekle', 'sleep')}`;
  }

  function monthExpenses(date = new Date()) { const prefix = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; return state.expenses.filter(item => item.date.startsWith(prefix)); }

  function monthIncomes(date = new Date()) { const prefix = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; return state.incomes.filter(item => item.date.startsWith(prefix)); }

  function financialMonth(date = new Date()) {
    const incomes = monthIncomes(date);
    const expenses = monthExpenses(date);
    const income = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
    const expense = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    return { incomes, expenses, income, expense, net: income - expense };
  }

  function changeLabel(current, previous, expense = false) {
    if (!previous && !current) return { text: 'Değişim yok', tone: '' };
    if (!previous) return { text: 'Bu ay yeni', tone: expense ? 'warn' : 'good' };
    const percent = Math.round((current - previous) / previous * 100);
    if (!percent) return { text: 'Geçen ayla aynı', tone: '' };
    const favorable = expense ? percent < 0 : percent > 0;
    return { text: `${percent > 0 ? '↑' : '↓'} %${Math.abs(percent)} geçen aya göre`, tone: favorable ? 'good' : 'warn' };
  }

  function currentMonthKey(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; }

  function recurringTypeLabel(type) { return ({ fixed: 'Sabit gider', bill: 'Fatura / abonelik', statement: 'Kredi kartı ekstresi' })[type] || 'Düzenli gider'; }

  function recurringDueLabel(item, paid) {
    if (paid) return 'Ödendi';
    const today = new Date();
    const dueDay = clamp(Number(item.dueDay) || 1, 1, 31);
    return today.getDate() > dueDay ? `Gecikti · ${dueDay}. gün` : `${dueDay}. gün`;
  }

  function renderBudgetPlan() {
    const current = financialMonth();
    const previousDate = new Date(); previousDate.setMonth(previousDate.getMonth() - 1);
    const previous = financialMonth(previousDate);
    const items = [...current.incomes.map(item => ({ ...item, transactionType: 'income' })), ...current.expenses.map(item => ({ ...item, transactionType: 'expense' }))].sort((a, b) => b.date.localeCompare(a.date));
    const spent = current.expense;
    const limit = Number(state.settings.monthlyBudget || 0);
    const byCategory = Object.entries(current.expenses.reduce((map, item) => { map[item.category] = (map[item.category] || 0) + Number(item.amount); return map; }, {})).sort((a, b) => b[1] - a[1]);
    const bySource = Object.entries(current.incomes.reduce((map, item) => { map[item.source] = (map[item.source] || 0) + Number(item.amount); return map; }, {})).sort((a, b) => b[1] - a[1]);
    const totalSavings = Number(state.settings.startingSavings || 0) + state.incomes.reduce((sum, item) => sum + Number(item.amount), 0) - state.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const target = Number(state.settings.savingsTarget || 0);
    const incomeDelta = changeLabel(current.income, previous.income);
    const expenseDelta = changeLabel(current.expense, previous.expense, true);
    const netDelta = changeLabel(Math.max(0, current.net), Math.max(0, previous.net));
    const chartMonths = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - 5 + index); return { date, ...financialMonth(date) }; });
    const chartMax = Math.max(1, ...chartMonths.flatMap(item => [item.income, item.expense]));
    const monthKey = currentMonthKey();
    const recurring = [...state.recurringExpenses].sort((a, b) => Number(a.dueDay) - Number(b.dueDay));
    const recurringTotal = recurring.reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringPaid = recurring.filter(item => (item.paidMonths || []).includes(monthKey)).reduce((sum, item) => sum + Number(item.amount), 0);
    return `<article class="finance-hero"><div class="row between"><div><div class="stat-label">Toplam birikim</div><div class="finance-balance ${totalSavings < 0 ? 'money-negative' : ''}">${money(totalSavings)}</div><div class="finance-target">Hedef: ${money(target)} · %${target ? Math.round(clamp(totalSavings / target * 100, 0, 100)) : 0} tamamlandı</div></div><button class="button" type="button" data-settings-budget>Ayarla</button></div><div class="progress-track good"><span style="width:${target ? clamp(totalSavings / target * 100, 0, 100) : 0}%"></span></div></article>
      <div class="finance-grid">
        <div class="finance-tile"><div class="stat-label">Bu ay gelir</div><div class="stat-value money-positive">${money(current.income)}</div><div class="delta ${incomeDelta.tone}">${incomeDelta.text}</div></div>
        <div class="finance-tile"><div class="stat-label">Bu ay gider</div><div class="stat-value">${money(current.expense)}</div><div class="delta ${expenseDelta.tone}">${expenseDelta.text}</div></div>
        <div class="finance-tile"><div class="stat-label">Net birikim</div><div class="stat-value ${current.net >= 0 ? 'money-positive' : 'money-negative'}">${money(current.net)}</div><div class="delta ${netDelta.tone}">${netDelta.text}</div></div>
      </div>
      <article class="card"><div class="row between"><div><p class="item-title">Gelir / gider gidişatı</p><p class="item-detail">Son 6 ay</p></div><div class="legend"><span>Gelir</span><span>Gider</span></div></div><div class="cashflow-chart">${chartMonths.map(item => `<div class="cashflow-month"><div class="cashflow-bars"><span class="cashflow-bar" style="height:${Math.max(3, item.income / chartMax * 100)}%" title="Gelir ${money(item.income)}"></span><span class="cashflow-bar expense" style="height:${Math.max(3, item.expense / chartMax * 100)}%" title="Gider ${money(item.expense)}"></span></div><span class="cashflow-label">${new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(item.date)}</span></div>`).join('')}</div></article>
      <article class="card"><div class="row between"><div><p class="item-title">Aylık harcama sınırı</p><p class="item-detail">${money(spent)} / ${money(limit)} · ${money(Math.max(0, limit - spent))} kaldı</p></div><strong>%${limit ? Math.round(spent / limit * 100) : 0}</strong></div><div class="progress-track ${spent > limit ? 'warn' : 'good'}"><span style="width:${clamp(limit ? spent / limit * 100 : 0, 0, 100)}%"></span></div></article>
      <div class="mini-grid"><div class="stat-card"><div class="stat-label">En yüksek gelir</div><div class="stat-value">${esc(bySource[0]?.[0] || '—')}</div><div class="stat-note">${bySource[0] ? money(bySource[0][1]) : 'Kayıt yok'}</div></div><div class="stat-card"><div class="stat-label">En yüksek gider</div><div class="stat-value">${esc(byCategory[0]?.[0] || '—')}</div><div class="stat-note">${byCategory[0] ? money(byCategory[0][1]) : 'Kayıt yok'}</div></div></div>
      <div class="row between"><div><div class="section-label">Aylık düzenli giderler</div><p class="item-detail">Kira, faturalar, abonelikler ve ekstreler</p></div><button class="button" type="button" data-add="recurring-expense">+ Ekle</button></div>
      ${recurring.length ? `<article class="card recurring-summary"><div class="row between"><div><p class="item-title">Bu ay ${money(recurringTotal)}</p><p class="item-detail">${money(recurringPaid)} ödendi · ${money(recurringTotal - recurringPaid)} bekliyor</p></div><strong>%${recurringTotal ? Math.round(recurringPaid / recurringTotal * 100) : 0}</strong></div><div class="progress-track good"><span style="width:${recurringTotal ? recurringPaid / recurringTotal * 100 : 0}%"></span></div></article><div class="recurring-list">${recurring.map(item => { const paid = (item.paidMonths || []).includes(monthKey); return `<article class="card"><div class="row"><div class="module-icon">↻</div><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${recurringTypeLabel(item.type)} · ${esc(item.category)} · <span class="${!paid && new Date().getDate() > Number(item.dueDay) ? 'money-negative' : ''}">${recurringDueLabel(item, paid)}</span></p></div><strong>${money(item.amount)}</strong><button class="icon-button" type="button" data-edit-recurring-expense="${item.id}" aria-label="${esc(item.title)} giderini düzenle">···</button></div><button class="button block ${paid ? '' : 'primary'}" type="button" data-toggle-recurring-paid="${item.id}">${paid ? 'Ödemeyi geri al' : 'Ödendi olarak işaretle'}</button></article>`; }).join('')}</div>` : `<article class="card empty-state"><div class="empty-icon">↻</div><h3>Düzenli gider eklenmemiş</h3><p>Kira, fatura, abonelik veya aylık kredi kartı ekstreni ekle.</p><button class="button" type="button" data-add="recurring-expense">Düzenli gider ekle</button></article>`}
      <div class="row between"><div class="section-label">Bu ayın hareketleri</div><div class="row"><button class="button" type="button" data-add="income">+ Gelir</button><button class="button" type="button" data-add="expense">+ Gider</button></div></div>
      ${items.length ? items.map(item => item.transactionType === 'income' ? `<article class="card"><div class="row"><div class="module-icon">＋</div><div class="grow"><p class="item-title">${esc(item.note || item.source)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.source)} · ${incomeKindLabel(item.kind)}</p></div><strong class="money-positive">+${money(item.amount)}</strong><button class="icon-button" type="button" data-edit-income="${item.id}">···</button></div></article>` : `<article class="card"><div class="row"><div class="module-icon">₺</div><div class="grow"><p class="item-title">${esc(item.note || item.category)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.category)}${item.planned ? ' · Planlı' : ' · Plansız'}</p></div><strong>−${money(item.amount)}</strong><button class="icon-button" type="button" data-edit-expense="${item.id}">···</button></div></article>`).join('') : `<article class="card empty-state"><div class="empty-icon">₺</div><h3>Henüz finans hareketi yok</h3><p>Gelir veya gider eklediğinde pano otomatik hesaplanacak.</p><div class="row" style="justify-content:center"><button class="button" type="button" data-add="income">Gelir ekle</button><button class="button" type="button" data-add="expense">Gider ekle</button></div></article>`}`;
  }

  function incomeKindLabel(kind) { return ({ regular: 'Düzenli', extra: 'Ekstra', investment: 'Yatırım getirisi' })[kind] || 'Ekstra'; }

  function average(values) { const usable = values.filter(value => Number.isFinite(Number(value))).map(Number); return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : 0; }
  function formatDuration(minutes) { if (!minutes) return '—'; return `${Math.floor(minutes / 60)} sa ${Math.round(minutes % 60)} dk`; }
  function sleepDuration(bed, wake) { const [bh, bm] = bed.split(':').map(Number); const [wh, wm] = wake.split(':').map(Number); let value = (wh * 60 + wm) - (bh * 60 + bm); if (value <= 0) value += 1440; return value; }

  function rangeMetrics(start, end) {
    const tasks = state.tasks.filter(x => x.date >= start && x.date <= end);
    const workouts = state.workouts.filter(x => x.date >= start && x.date <= end);
    const sleep = state.sleepEntries.filter(x => x.date >= start && x.date <= end);
    const expenses = state.expenses.filter(x => x.date >= start && x.date <= end);
    return {
      taskTotal: tasks.length,
      taskDone: tasks.filter(x => x.done).length,
      taskRate: tasks.length ? Math.round(tasks.filter(x => x.done).length / tasks.length * 100) : 0,
      workoutTotal: workouts.length,
      workoutDone: workouts.filter(x => x.done).length,
      sleepAvg: average(sleep.map(x => x.duration)),
      energyAvg: average(sleep.map(x => Number(x.energy))),
      spend: expenses.reduce((sum, x) => sum + Number(x.amount), 0),
      unplanned: expenses.filter(x => !x.planned).reduce((sum, x) => sum + Number(x.amount), 0)
    };
  }

  function weeklyMetrics(offset = 0) {
    const start = startOfWeek();
    start.setDate(start.getDate() + offset * 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { start: toISO(start), end: toISO(end), ...rangeMetrics(toISO(start), toISO(end)) };
  }

  function weeklyEvaluation() {
    const m = weeklyMetrics();
    const parts = [];
    if (m.taskTotal) parts.push(`${m.taskTotal} görevin ${m.taskDone} tanesini tamamladın (%${m.taskRate}).`); else parts.push('Bu hafta henüz görev kaydı yok.');
    if (m.workoutTotal) parts.push(`${m.workoutTotal} antrenmanın ${m.workoutDone} tanesi tamamlandı.`); else parts.push('Bu hafta spor planı görünmüyor.');
    if (m.sleepAvg) parts.push(`Ortalama uykun ${formatDuration(m.sleepAvg)}, sabah enerjin ${m.energyAvg.toFixed(1)}/5.`); else parts.push('Uyku düzenini yorumlamak için en az bir kayıt ekle.');
    const weeklyLimit = Number(state.settings.monthlyBudget || 0) / 4.345;
    parts.push(`Haftalık harcaman ${money(m.spend)}${weeklyLimit ? `; yaklaşık sınırın ${money(weeklyLimit)}` : ''}.`);
    let focus = 'Gelecek hafta için tek bir net öncelik seç ve takvime saatini koy.';
    if (m.sleepAvg && m.sleepAvg < 420) focus = 'Önce uykuyu düzelt: yatış saatini en az dört gece aynı aralıkta tut.';
    else if (m.taskTotal && m.taskRate < 60) focus = 'Yeni görev eklemeden önce açık iş sayısını azalt; gelecek haftaya en fazla üç öncelik taşı.';
    else if (weeklyLimit && m.spend > weeklyLimit) focus = 'Değişken harcamalara haftalık bir üst sınır koy ve plansız giderleri ertesi güne beklet.';
    else if (m.workoutTotal && m.workoutDone < m.workoutTotal) focus = 'Eksik antrenmanı telafi etmeye çalışma; gelecek haftanın günlerini şimdiden sabitle.';
    return { title: m.taskRate >= 75 ? 'Ritmi koru, bir noktayı iyileştir' : m.taskRate >= 50 ? 'Temel iyi, odağı daralt' : 'Planı sadeleştir ve yeniden başla', body: parts.join(' '), focus, metrics: m };
  }

  function budgetEvaluation() {
    const items = monthExpenses();
    const incomes = monthIncomes();
    const spent = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const income = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
    const net = income - spent;
    const limit = Number(state.settings.monthlyBudget || 0);
    const date = new Date();
    const elapsed = date.getDate() / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const expected = limit * elapsed;
    const categories = Object.entries(items.reduce((map, item) => { map[item.category] = (map[item.category] || 0) + Number(item.amount); return map; }, {})).sort((a, b) => b[1] - a[1]);
    const unplanned = items.filter(x => !x.planned).reduce((sum, x) => sum + Number(x.amount), 0);
    const pace = !limit ? 'Aylık sınırını belirlediğinde harcama hızını yorumlayabilirim.' : spent <= expected ? `Harcama hızın şu an planın ${money(expected - spent)} altında.` : `Harcama hızın şu an planın ${money(spent - expected)} üzerinde.`;
    const detail = items.length || incomes.length ? `${pace} Bu ay ${money(income)} gelir ve ${money(spent)} gider kaydettin; net birikimin ${money(net)}. ${categories[0] ? `En yüksek gider kategorin ${categories[0][0]}: ${money(categories[0][1])}. ` : ''}Plansız harcamaların toplamı ${money(unplanned)}.` : 'Bu ay henüz gelir veya gider kaydı yok. Birkaç kayıt eklediğinde birikim ve harcama hızı değerlendirmesi oluşacak.';
    const suggestion = net < 0 ? 'Bu ay gider geliri geçti. Önce zorunlu olmayan harcamaları durdur ve yeni gelirleri ayrı kaydet.' : spent > expected ? 'Kalan günler için günlük sınırı düşür ve plansız alımlarda 24 saat bekle.' : unplanned > spent * .3 ? 'Plansız harcamaların payını azaltmak için haftalık serbest harcama limiti koy.' : 'Net birikimin pozitif. Ekstra gelirlerin için önceden bir birikim veya yatırım oranı belirle.';
    return { title: spent <= expected ? 'Bütçe plan içinde' : 'Harcama hızını düşür', detail, suggestion };
  }

  function renderProgress() {
    setHeader('Son 7 gün', 'İlerleme');
    const m = weeklyMetrics();
    const weeks = [-3, -2, -1, 0].map(weeklyMetrics);
    const maxRate = Math.max(100, ...weeks.map(x => x.taskRate));
    view.innerHTML = `<div class="stack">
      <div class="section-label">Bu hafta</div>
      <div class="mini-grid">
        <div class="stat-card"><div class="stat-label">Öncelikler</div><div class="stat-value">${m.taskDone} / ${m.taskTotal}</div><div class="stat-note">%${m.taskRate} tamamlandı</div></div>
        <div class="stat-card"><div class="stat-label">Antrenman</div><div class="stat-value">${m.workoutDone} / ${m.workoutTotal}</div><div class="stat-note">Bu hafta</div></div>
        <div class="stat-card"><div class="stat-label">Uyku</div><div class="stat-value">${formatDuration(m.sleepAvg)}</div><div class="stat-note">Haftalık ortalama</div></div>
        <div class="stat-card"><div class="stat-label">Bütçe</div><div class="stat-value">${money(m.spend)}</div><div class="stat-note">Son 7 gün</div></div>
      </div>
      <article class="card"><div class="row between"><div><p class="item-title">Dört haftalık gidişat</p><p class="item-detail">Tamamlanan görev oranı</p></div><span class="muted">↗</span></div><div class="bar-chart">${weeks.map((week, index) => `<div class="bar-column"><span class="bar-value">%${week.taskRate}</span><span class="bar" style="height:${Math.max(5, week.taskRate / maxRate * 100)}%"></span><span class="bar-label">${index === 3 ? 'Bu hafta' : `${4 - index} hf.`}</span></div>`).join('')}</div></article>
      <article class="card"><p class="item-title">Haftanın değerlendirmesi</p><p class="item-detail">Görev, spor, uyku ve bütçe kayıtlarından anında hazırlanır.</p><div class="action-grid"><button class="button primary" type="button" data-open-evaluation>Değerlendirmeyi aç</button><button class="button" type="button" data-open-week-review>Haftayı değerlendir</button></div></article>
      <article class="card"><p class="item-title">Bütçe değerlendirmesi</p><p class="item-detail">Harcama hızını, kategorileri ve plansız giderleri yorumlar.</p><button class="button block" style="margin-top:12px" type="button" data-open-budget-evaluation>Bütçeyi değerlendir</button></article>
      ${state.weeklyReviews.length ? `<div class="section-label">Kayıtlı değerlendirmeler</div>${[...state.weeklyReviews].sort((a,b)=>b.weekStart.localeCompare(a.weekStart)).slice(0,3).map(r => `<article class="card"><p class="item-title">${shortDate(r.weekStart)} haftası</p><p class="item-detail"><strong>İyi:</strong> ${esc(r.good || '—')}<br><strong>Zorluk:</strong> ${esc(r.hard || '—')}<br><strong>Odak:</strong> ${esc(r.focus || '—')}</p></article>`).join('')}` : ''}
    </div>`;
  }

  function formActions(editing) { return `<div class="form-actions">${editing ? '<button class="button danger" type="button" data-delete-item>Sil</button>' : ''}<button class="button primary" type="submit">Kaydet</button></div>`; }

  function openTaskForm(existing, presetDate) {
    const item = existing || { title: '', date: presetDate || todayISO(), time: '09:00', priority: false, notes: '' };
    openSheet('Plan', existing ? 'Görevi düzenle' : 'Görev ekle', `<form class="form" id="item-form">
      <label class="field">Görev<input name="title" maxlength="100" required value="${esc(item.title)}" placeholder="Ne yapacaksın?"></label>
      <div class="form-row"><label class="field">Tarih<input name="date" type="date" required value="${item.date}"></label><label class="field">Saat<input name="time" type="time" value="${item.time || ''}"></label></div>
      <label class="checkbox-field"><input name="priority" type="checkbox" ${item.priority ? 'checked' : ''}> Bugünün önceliklerine ekle</label>
      <label class="field">Kısa not<input name="notes" maxlength="140" value="${esc(item.notes || '')}" placeholder="İstersen boş bırak"></label>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), title: data.get('title').trim(), date: data.get('date'), time: data.get('time'), priority: data.get('priority') === 'on', notes: data.get('notes').trim(), done: existing?.done || false }; if (existing) Object.assign(existing, next); else state.tasks.push(next); save(); closeSheet(); render(); showToast('Görev kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.tasks = state.tasks.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Görev silindi'); });
    });
  }

  function openWorkoutForm(existing, presetDate) {
    const item = existing || { title: '', date: presetDate || todayISO(), time: '18:30', duration: 45, exercises: '' };
    const existingExercises = existing ? workoutExercises(existing) : [];
    const exerciseText = existingExercises.length ? existingExercises.map(x => x.name).join('\n') : (item.exercises || '');
    openSheet('Spor', existing ? 'Antrenmanı düzenle' : 'Antrenman planla', `<form class="form" id="item-form">
      <label class="field">Antrenman adı<input name="title" maxlength="80" required value="${esc(item.title)}" placeholder="Örn. Üst vücut"></label>
      <div class="form-row"><label class="field">Tarih<input name="date" type="date" required value="${item.date}"></label><label class="field">Saat<input name="time" type="time" value="${item.time || ''}"></label></div>
      <label class="field">Süre (dakika)<input name="duration" type="number" min="5" max="300" required value="${item.duration}"></label>
      <label class="field">Hareketler <span class="small">Her satıra bir hareket; set ve tekrarı yanına yaz.</span><textarea name="exercises" maxlength="800" placeholder="Bench press — 4×8&#10;Row — 4×10&#10;Lateral raise — 3×12">${esc(exerciseText)}</textarea></label>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const exerciseNames = data.get('exercises').split(/\r?\n/).map(name => name.trim()).filter(Boolean); const exerciseItems = exerciseNames.map(name => { const previous = existingExercises.find(x => x.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')); return { id: previous?.id || id(), name, done: previous?.done || false }; }); const next = { id: existing?.id || id(), title: data.get('title').trim(), date: data.get('date'), time: data.get('time'), duration: Number(data.get('duration')), exercises: exerciseNames.join('\n'), exerciseItems, done: exerciseItems.length ? exerciseItems.every(x => x.done) : (existing?.done || false) }; if (existing) Object.assign(existing, next); else state.workouts.push(next); save(); closeSheet(); render(); showToast('Antrenman kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.workouts = state.workouts.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Antrenman silindi'); });
    });
  }

  function openWorkoutDetail(item) {
    const exercises = ensureWorkoutExercises(item);
    const completed = exercises.filter(x => x.done).length;
    const allDone = exercises.length > 0 && completed === exercises.length;
    openSheet('Spor programı', item.title, `<div class="stack">
      <div><p class="sheet-copy">${shortDate(item.date)} · ${esc(item.time || 'Saat yok')} · ${item.duration} dakika</p><div class="row between"><span class="exercise-count">${completed} / ${exercises.length} hareket tamamlandı</span><strong>%${exercises.length ? Math.round(completed / exercises.length * 100) : 0}</strong></div><div class="progress-track good"><span style="width:${exercises.length ? completed / exercises.length * 100 : 0}%"></span></div></div>
      ${exercises.length ? `<div class="exercise-list">${exercises.map(exercise => `<button class="exercise-row ${exercise.done ? 'done' : ''}" type="button" data-toggle-exercise="${exercise.id}"><span class="check-button ${exercise.done ? 'done' : ''}">✓</span><span class="grow"><span class="item-title">${esc(exercise.name)}</span></span></button>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">↗</div><h3>Hareket eklenmemiş</h3><p>Antrenmanı düzenleyip hareketleri her satıra bir tane yaz.</p></div>`}
      <div class="form-actions">${exercises.length ? `<button class="button ${allDone ? '' : 'good'}" type="button" data-complete-workout>${allDone ? 'Tümünü geri al' : 'Antrenmanı tamamla'}</button>` : ''}<button class="button" type="button" data-edit-workout-detail>Düzenle</button></div>
    </div>`, root => {
      $$('[data-toggle-exercise]', root).forEach(button => button.addEventListener('click', () => { const exercise = exercises.find(x => x.id === button.dataset.toggleExercise); if (!exercise) return; exercise.done = !exercise.done; item.done = exercises.length > 0 && exercises.every(x => x.done); save(); render(); closeSheet(); openWorkoutDetail(item); }));
      $('[data-complete-workout]', root)?.addEventListener('click', () => { exercises.forEach(x => { x.done = !allDone; }); item.done = !allDone; save(); render(); closeSheet(); openWorkoutDetail(item); showToast(item.done ? 'Antrenman tamamlandı' : 'Antrenman yeniden açıldı'); });
      $('[data-edit-workout-detail]', root).addEventListener('click', () => openWorkoutForm(item));
    });
  }

  function openExpenseForm(existing, presetDate) {
    const item = existing || { amount: '', date: presetDate || todayISO(), category: 'Diğer', note: '', planned: true };
    openSheet('Bütçe', existing ? 'Harcamayı düzenle' : 'Harcama ekle', `<form class="form" id="item-form">
      <label class="field">Tutar (TL)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${item.amount}" placeholder="0"></label>
      <div class="form-row"><label class="field">Tarih<input name="date" type="date" required value="${item.date}"></label><label class="field">Kategori<select name="category">${['Market','Ulaşım','Fatura','Sosyal','Sağlık','Alışveriş','Diğer'].map(x => `<option ${x === item.category ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <label class="field">Açıklama<input name="note" maxlength="100" value="${esc(item.note || '')}" placeholder="Ne için?"></label>
      <label class="checkbox-field"><input name="planned" type="checkbox" ${item.planned ? 'checked' : ''}> Planlı harcama</label>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), amount: Number(data.get('amount')), date: data.get('date'), category: data.get('category'), note: data.get('note').trim(), planned: data.get('planned') === 'on' }; if (existing) Object.assign(existing, next); else state.expenses.push(next); save(); closeSheet(); render(); showToast('Harcama kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.expenses = state.expenses.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Harcama silindi'); });
    });
  }

  function openIncomeForm(existing, presetDate) {
    const item = existing || { amount: '', date: presetDate || todayISO(), source: 'Ek gelir', kind: 'extra', note: '' };
    openSheet('Gelir', existing ? 'Geliri düzenle' : 'Gelir ekle', `<form class="form" id="item-form">
      <label class="field">Tutar (TL)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${item.amount}" placeholder="0"></label>
      <div class="form-row"><label class="field">Tarih<input name="date" type="date" required value="${item.date}"></label><label class="field">Gelir türü<select name="kind"><option value="regular" ${item.kind === 'regular' ? 'selected' : ''}>Düzenli gelir</option><option value="extra" ${item.kind === 'extra' ? 'selected' : ''}>Ekstra gelir</option><option value="investment" ${item.kind === 'investment' ? 'selected' : ''}>Yatırım getirisi</option></select></label></div>
      <label class="field">Kaynak<input name="source" maxlength="60" required value="${esc(item.source || '')}" placeholder="Maaş, prim, fon getirisi..."></label>
      <label class="field">Açıklama<input name="note" maxlength="100" value="${esc(item.note || '')}" placeholder="İstersen boş bırak"></label>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), amount: Number(data.get('amount')), date: data.get('date'), kind: data.get('kind'), source: data.get('source').trim(), note: data.get('note').trim() }; if (existing) Object.assign(existing, next); else state.incomes.push(next); save(); closeSheet(); render(); showToast('Gelir kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.incomes = state.incomes.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Gelir silindi'); });
    });
  }

  function openRecurringExpenseForm(existing) {
    const item = existing || { title: '', amount: '', type: 'fixed', category: 'Fatura', dueDay: 1, paidMonths: [] };
    const categories = ['Kira', 'Fatura', 'Abonelik', 'Kredi kartı', 'Aidat', 'Kredi', 'Sigorta', 'Diğer'];
    openSheet('Bütçe', existing ? 'Düzenli gideri düzenle' : 'Düzenli gider ekle', `<form class="form" id="recurring-expense-form">
      <label class="field">Gider adı<input name="title" maxlength="80" required value="${esc(item.title)}" placeholder="Kira, elektrik, kredi kartı ekstresi..."></label>
      <label class="field">Bu ayki tutar (TL)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${item.amount}" placeholder="0"></label>
      <div class="form-row"><label class="field">Tür<select name="type"><option value="fixed" ${item.type === 'fixed' ? 'selected' : ''}>Sabit gider</option><option value="bill" ${item.type === 'bill' ? 'selected' : ''}>Fatura / abonelik</option><option value="statement" ${item.type === 'statement' ? 'selected' : ''}>Kredi kartı ekstresi</option></select></label><label class="field">Kategori<select name="category">${categories.map(x => `<option ${x === item.category ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <label class="field">Son ödeme günü<input name="dueDay" type="number" min="1" max="31" required value="${item.dueDay}"></label>
      <p class="sheet-copy">Ekstre ve fatura tutarı değiştiğinde kalemi düzenleyebilirsin. “Ödendi” dediğinde bu ayın giderlerine otomatik eklenir.</p>${formActions(Boolean(existing))}</form>`, root => {
      $('#recurring-expense-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), title: data.get('title').trim(), amount: Number(data.get('amount')), type: data.get('type'), category: data.get('category'), dueDay: Number(data.get('dueDay')), paidMonths: existing?.paidMonths || [] }; if (existing) { Object.assign(existing, next); const payment = state.expenses.find(x => x.recurringExpenseId === existing.id && x.recurringMonth === currentMonthKey()); if (payment) { payment.amount = next.amount; payment.category = next.category; payment.note = next.title; } } else state.recurringExpenses.push(next); save(); closeSheet(); render(); showToast('Düzenli gider kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.recurringExpenses = state.recurringExpenses.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Düzenli gider silindi'); });
    });
  }

  function toggleRecurringPaid(item) {
    const monthKey = currentMonthKey();
    item.paidMonths = Array.isArray(item.paidMonths) ? item.paidMonths : [];
    const paid = item.paidMonths.includes(monthKey);
    if (paid) {
      item.paidMonths = item.paidMonths.filter(key => key !== monthKey);
      state.expenses = state.expenses.filter(expense => !(expense.recurringExpenseId === item.id && expense.recurringMonth === monthKey));
      showToast('Ödeme geri alındı');
    } else {
      item.paidMonths.push(monthKey);
      if (!state.expenses.some(expense => expense.recurringExpenseId === item.id && expense.recurringMonth === monthKey)) state.expenses.push({ id: id(), amount: Number(item.amount), date: todayISO(), category: item.category, note: item.title, planned: true, recurringExpenseId: item.id, recurringMonth: monthKey });
      showToast('Bu ay ödendi olarak işaretlendi');
    }
    save(); render();
  }

  function openSleepForm(existing) {
    const item = existing || { date: addDays(todayISO(), -1), bedTime: state.settings.bedtime, wakeTime: state.settings.wakeTime, energy: 3, quality: 3 };
    openSheet('Uyku', existing ? 'Uyku kaydını düzenle' : 'Uyku kaydet', `<form class="form" id="item-form">
      <label class="field">Uyandığın gün<input name="date" type="date" required value="${item.date}"></label>
      <div class="form-row"><label class="field">Yatış<input name="bedTime" type="time" required value="${item.bedTime}"></label><label class="field">Kalkış<input name="wakeTime" type="time" required value="${item.wakeTime}"></label></div>
      <div class="form-row"><label class="field">Sabah enerjisi<select name="energy">${[1,2,3,4,5].map(x => `<option value="${x}" ${Number(item.energy) === x ? 'selected' : ''}>${x} / 5</option>`).join('')}</select></label><label class="field">Uyku kalitesi<select name="quality">${[1,2,3,4,5].map(x => `<option value="${x}" ${Number(item.quality) === x ? 'selected' : ''}>${x} / 5</option>`).join('')}</select></label></div>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const bedTime = data.get('bedTime'); const wakeTime = data.get('wakeTime'); const next = { id: existing?.id || id(), date: data.get('date'), bedTime, wakeTime, energy: Number(data.get('energy')), quality: Number(data.get('quality')), duration: sleepDuration(bedTime, wakeTime) }; if (existing) Object.assign(existing, next); else { state.sleepEntries = state.sleepEntries.filter(x => x.date !== next.date); state.sleepEntries.push(next); } save(); closeSheet(); render(); showToast('Uyku kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.sleepEntries = state.sleepEntries.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Uyku kaydı silindi'); });
    });
  }

  function openRoutine() {
    const date = todayISO();
    const done = state.routineLogs[date] || [];
    openSheet('Akşam rutini', `${state.settings.bedtime} için hazırlan`, `<div class="stack">${state.routine.map(item => `<button class="list-item clickable ${done.includes(item.id) ? 'is-done' : ''}" type="button" data-routine="${item.id}"><span class="check-button ${done.includes(item.id) ? 'done' : ''}">✓</span><span class="grow"><span class="item-title">${esc(item.title)}</span><br><span class="item-detail">${esc(item.time)}</span></span></button>`).join('')}<button class="button" type="button" data-settings-sleep>Uyku hedefini düzenle</button></div>`, root => {
      $$('[data-routine]', root).forEach(button => button.addEventListener('click', () => { const list = state.routineLogs[date] || []; state.routineLogs[date] = list.includes(button.dataset.routine) ? list.filter(x => x !== button.dataset.routine) : [...list, button.dataset.routine]; save(); closeSheet(); openRoutine(); render(); }));
      $('[data-settings-sleep]', root).addEventListener('click', openSleepSettings);
    });
  }

  function openSleepSettings() {
    openSheet('Ayar', 'Uyku hedefi', `<form class="form" id="sleep-settings-form"><div class="form-row"><label class="field">Yatış hedefi<input name="bedtime" type="time" required value="${state.settings.bedtime}"></label><label class="field">Kalkış hedefi<input name="wakeTime" type="time" required value="${state.settings.wakeTime}"></label></div><button class="button primary block" type="submit">Kaydet</button></form>`, root => {
      $('#sleep-settings-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); state.settings.bedtime = data.get('bedtime'); state.settings.wakeTime = data.get('wakeTime'); save(); closeSheet(); render(); showToast('Uyku hedefi güncellendi'); });
    });
  }

  function openBudgetSettings() {
    openSheet('Ayar', 'Bütçe ve birikim', `<form class="form" id="budget-settings-form"><label class="field">Aylık harcama sınırı (TL)<input name="monthlyBudget" type="number" min="0" step="100" required value="${state.settings.monthlyBudget}"></label><div class="form-row"><label class="field">Başlangıç birikimi (TL)<input name="startingSavings" type="number" step="100" required value="${state.settings.startingSavings}"></label><label class="field">Birikim hedefi (TL)<input name="savingsTarget" type="number" min="0" step="100" required value="${state.settings.savingsTarget}"></label></div><p class="sheet-copy">Gelir ve gider kayıtlarından önce elinde olan birikimi yaz. Pano sonraki tüm hareketleri bunun üzerine ekler.</p><button class="button primary block" type="submit">Kaydet</button></form>`, root => {
      $('#budget-settings-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); state.settings.monthlyBudget = Number(data.get('monthlyBudget')); state.settings.startingSavings = Number(data.get('startingSavings')); state.settings.savingsTarget = Number(data.get('savingsTarget')); save(); closeSheet(); render(); showToast('Bütçe ve birikim güncellendi'); });
    });
  }

  function evaluationShareText() {
    const e = weeklyEvaluation();
    const latestReview = [...state.weeklyReviews].sort((a,b)=>b.weekStart.localeCompare(a.weekStart))[0];
    return `KİŞİSEL MERKEZ — HAFTALIK ÖZET\n\n${e.body}\n\nÖnerilen odak: ${e.focus}${latestReview ? `\n\nBenim değerlendirmem:\nİyi giden: ${latestReview.good}\nZorlandığım: ${latestReview.hard}\nGelecek hafta odağım: ${latestReview.focus}` : ''}\n\nBu verilere göre bana kısa, net ve uygulanabilir bir haftalık plan hazırla.`;
  }

  function openEvaluation() {
    const e = weeklyEvaluation();
    openSheet('Haftalık değerlendirme', e.title, `<p class="sheet-copy">${esc(e.body)}</p><div class="evaluation-box"><strong>Gelecek haftanın odağı:</strong><br>${esc(e.focus)}</div><div class="action-grid"><button class="button primary" type="button" data-chatgpt-share>ChatGPT’ye aktar</button><button class="button" type="button" data-open-week-review>Ben değerlendir</button></div>`, root => {
      $('[data-chatgpt-share]', root).addEventListener('click', shareEvaluation);
      $('[data-open-week-review]', root).addEventListener('click', openWeekReview);
    });
  }

  async function shareEvaluation() {
    const text = evaluationShareText();
    try {
      if (navigator.share) await navigator.share({ title: 'Haftalık değerlendirmem', text });
      else { await navigator.clipboard.writeText(text); showToast('Özet kopyalandı; ChatGPT’ye yapıştırabilirsin'); }
    } catch (error) { if (error.name !== 'AbortError') showToast('Paylaşım açılamadı'); }
  }

  function openWeekReview() {
    const week = toISO(startOfWeek());
    const existing = state.weeklyReviews.find(x => x.weekStart === week);
    openSheet('5 dakikalık kontrol', 'Bu haftayı değerlendir', `<form class="form" id="week-review-form"><label class="field">Bu hafta ne iyi gitti?<textarea name="good" maxlength="500" placeholder="Kısa bir cümle yeterli">${esc(existing?.good || '')}</textarea></label><label class="field">Nerede zorlandın?<textarea name="hard" maxlength="500" placeholder="En önemli engeli yaz">${esc(existing?.hard || '')}</textarea></label><label class="field">Gelecek haftanın odağı ne?<textarea name="focus" maxlength="300" placeholder="Tek bir odak seç">${esc(existing?.focus || '')}</textarea></label><button class="button primary block" type="submit">Değerlendirmeyi kaydet</button></form>`, root => {
      $('#week-review-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), weekStart: week, good: data.get('good').trim(), hard: data.get('hard').trim(), focus: data.get('focus').trim() }; if (existing) Object.assign(existing, next); else state.weeklyReviews.push(next); save(); closeSheet(); render(); showToast('Haftalık değerlendirme kaydedildi'); });
    });
  }

  function openBudgetEvaluation() {
    const e = budgetEvaluation();
    openSheet('Bütçe değerlendirmesi', e.title, `<p class="sheet-copy">${esc(e.detail)}</p><div class="evaluation-box"><strong>Öneri:</strong><br>${esc(e.suggestion)}</div><div class="action-grid"><button class="button" type="button" data-add="income">Gelir ekle</button><button class="button" type="button" data-add="expense">Gider ekle</button></div>`, root => { $('[data-add="income"]', root).addEventListener('click', () => openIncomeForm()); $('[data-add="expense"]', root).addEventListener('click', () => openExpenseForm()); });
  }

  function openSettings() {
    openSheet('Kişisel Merkez', 'Ayarlar ve yedek', `<div class="settings-list">
      <form class="settings-block form" id="profile-form"><label class="field">Adın<input name="name" maxlength="40" required value="${esc(state.profile.name)}"></label><label class="field">Görünüm<select name="theme"><option value="auto" ${state.settings.theme === 'auto' ? 'selected' : ''}>Telefon ayarını kullan</option><option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Açık</option><option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Koyu</option></select></label><button class="button primary" type="submit">Ayarları kaydet</button></form>
      <div class="settings-block"><h3>Hatırlatmalar</h3><p>Görev ve spor saatlerinde bu cihazda bildirim gösterebilir. İlk sürümde kontrol uygulama açıkken yapılır.</p><button class="button" type="button" data-enable-notifications>${state.settings.notifications ? 'Bildirimler açık' : 'Bildirimleri aç'}</button></div>
      <div class="settings-block"><h3>Yedekleme</h3><p>Kayıtların bu cihazda saklanır. Yedeği dosya olarak indirip Google Drive veya iCloud Drive’a koyabilirsin.</p><div class="settings-actions"><button class="button" type="button" data-export>Yedeği indir</button><button class="button" type="button" data-import>Yedekten yükle</button></div></div>
      <div class="settings-block"><h3>iPhone’a kur</h3><p>Siteyi Safari’de aç. Paylaş simgesine dokunup “Ana Ekrana Ekle”yi seç.</p></div>
    </div>`, root => {
      $('#profile-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); state.profile.name = data.get('name').trim(); state.settings.theme = data.get('theme'); save(); applyTheme(); closeSheet(); render(); showToast('Ayarlar kaydedildi'); });
      $('[data-enable-notifications]', root).addEventListener('click', enableNotifications);
      $('[data-export]', root).addEventListener('click', exportBackup);
      $('[data-import]', root).addEventListener('click', () => $('#backup-file').click());
    });
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return showToast('Bu tarayıcı bildirimleri desteklemiyor');
    const permission = await Notification.requestPermission();
    state.settings.notifications = permission === 'granted';
    save();
    showToast(permission === 'granted' ? 'Bildirimler açıldı' : 'Bildirim izni verilmedi');
    closeSheet(); openSettings();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kisisel-merkez-yedek-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Yedek indirildi');
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported || imported.version !== 1 || !Array.isArray(imported.tasks)) throw new Error('Geçersiz yedek');
        state = imported; save(); applyTheme(); closeSheet(); render(); showToast('Yedek yüklendi');
      } catch (error) { showToast('Bu dosya geçerli bir Kişisel Merkez yedeği değil'); }
    };
    reader.readAsText(file);
  }

  function checkReminders() {
    if (!state.settings.notifications || Notification.permission !== 'granted') return;
    const now = new Date();
    const date = toISO(now);
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const candidates = [
      ...state.tasks.filter(x => x.date === date && x.time === time && !x.done).map(x => ({ id: `task-${x.id}-${date}`, title: 'Görev zamanı', body: x.title })),
      ...state.workouts.filter(x => x.date === date && x.time === time && !x.done).map(x => ({ id: `workout-${x.id}-${date}`, title: 'Spor zamanı', body: x.title }))
    ];
    candidates.forEach(item => {
      if (state.notified[item.id]) return;
      state.notified[item.id] = true; save();
      navigator.serviceWorker?.ready.then(reg => reg.showNotification(item.title, { body: item.body, icon: './icons/icon.svg', tag: item.id })).catch(() => new Notification(item.title, { body: item.body }));
    });
  }

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const register = tool => {
      try { Promise.resolve(context.registerTool(tool)).catch(error => console.warn(`WebMCP aracı kaydedilemedi: ${tool.name}`, error)); }
      catch (error) { console.warn(`WebMCP aracı kaydedilemedi: ${tool.name}`, error); }
    };
    const requireText = (value, field) => {
      if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} gerekli`);
      return value.trim();
    };
    const requireDate = value => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parseISO(value).getTime())) throw new Error('Tarih YYYY-AA-GG biçiminde olmalı');
      return value;
    };
    const optionalTime = value => {
      if (value == null || value === '') return '';
      if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Saat SS:DD biçiminde olmalı');
      return value;
    };

    register({
      name: 'read_dashboard_summary',
      title: 'Günlük özeti oku',
      description: 'Bugünkü görev, spor, uyku ve bütçe özetini veri değiştirmeden getirir.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const items = todayItems();
        return {
          date: todayISO(),
          tasks: { total: items.tasks.length, completed: items.tasks.filter(x => x.done).length, priorities: items.tasks.filter(x => x.priority).map(x => x.title) },
          workouts: items.workouts.map(x => { const exercises = workoutExercises(x); return { id: x.id, title: x.title, time: x.time, completed: x.done, completedExercises: exercises.filter(item => item.done).length, totalExercises: exercises.length, exercises: exercises.map(item => ({ id: item.id, name: item.name, done: item.done })) }; }),
          todaySpending: items.expenses.reduce((sum, x) => sum + Number(x.amount), 0),
          todayIncome: state.incomes.filter(x => x.date === todayISO()).reduce((sum, x) => sum + Number(x.amount), 0),
          sleepTarget: `${state.settings.bedtime}-${state.settings.wakeTime}`
        };
      }
    });

    register({
      name: 'create_task',
      title: 'Görev oluştur',
      description: 'Kişisel Merkez takvimine yeni bir görev ekler ve görünür ekranı günceller.',
      inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1, maxLength: 100 }, date: { type: 'string', description: 'YYYY-AA-GG' }, time: { type: 'string', description: 'SS:DD' }, priority: { type: 'boolean' }, notes: { type: 'string', maxLength: 140 } }, required: ['title', 'date'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const task = { id: id(), title: requireText(input?.title, 'Görev adı'), date: requireDate(input?.date), time: optionalTime(input?.time), priority: Boolean(input?.priority), notes: typeof input?.notes === 'string' ? input.notes.trim().slice(0, 140) : '', done: false };
        state.tasks.push(task); save(); render();
        return { id: task.id, status: 'created', title: task.title, date: task.date };
      }
    });

    register({
      name: 'plan_workout',
      title: 'Antrenman planla',
      description: 'Kişisel Merkez spor programına tarihli bir antrenman ekler.',
      inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1, maxLength: 80 }, date: { type: 'string', description: 'YYYY-AA-GG' }, time: { type: 'string', description: 'SS:DD' }, duration: { type: 'number', minimum: 5, maximum: 300 }, exercises: { type: 'string', maxLength: 800, description: 'Her satırda bir hareket; set ve tekrar bilgisi satırda yazılabilir.' } }, required: ['title', 'date', 'duration'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const duration = Number(input?.duration);
        if (!Number.isFinite(duration) || duration < 5 || duration > 300) throw new Error('Süre 5 ile 300 dakika arasında olmalı');
        const exerciseNames = typeof input?.exercises === 'string' ? input.exercises.trim().slice(0, 800).split(/\r?\n|,/).map(x => x.trim()).filter(Boolean) : [];
        const workout = { id: id(), title: requireText(input?.title, 'Antrenman adı'), date: requireDate(input?.date), time: optionalTime(input?.time), duration, exercises: exerciseNames.join('\n'), exerciseItems: exerciseNames.map(name => ({ id: id(), name, done: false })), done: false };
        state.workouts.push(workout); save(); render();
        return { id: workout.id, status: 'created', title: workout.title, date: workout.date, exerciseCount: workout.exerciseItems.length };
      }
    });

    register({
      name: 'set_workout_exercise_status',
      title: 'Spor hareketini işaretle',
      description: 'Bir antrenmandaki hareketi tamamlandı veya açık olarak işaretler; tüm hareketler bitince antrenmanı tamamlar.',
      inputSchema: { type: 'object', properties: { workoutId: { type: 'string' }, exerciseId: { type: 'string' }, done: { type: 'boolean' } }, required: ['workoutId', 'exerciseId', 'done'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const workout = state.workouts.find(x => x.id === input?.workoutId);
        if (!workout) throw new Error('Antrenman bulunamadı');
        const exercises = ensureWorkoutExercises(workout);
        const exercise = exercises.find(x => x.id === input?.exerciseId);
        if (!exercise) throw new Error('Hareket bulunamadı');
        exercise.done = Boolean(input.done);
        workout.done = exercises.length > 0 && exercises.every(x => x.done);
        save(); render();
        return { workoutId: workout.id, exerciseId: exercise.id, done: exercise.done, workoutCompleted: workout.done };
      }
    });

    register({
      name: 'record_expense',
      title: 'Harcama kaydet',
      description: 'Kişisel Merkez bütçesine yeni bir harcama kaydı ekler.',
      inputSchema: { type: 'object', properties: { amount: { type: 'number', exclusiveMinimum: 0 }, date: { type: 'string', description: 'YYYY-AA-GG' }, category: { type: 'string' }, note: { type: 'string', maxLength: 100 }, planned: { type: 'boolean' } }, required: ['amount', 'date', 'category'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const amount = Number(input?.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Tutar sıfırdan büyük olmalı');
        const expense = { id: id(), amount, date: requireDate(input?.date), category: requireText(input?.category, 'Kategori'), note: typeof input?.note === 'string' ? input.note.trim().slice(0, 100) : '', planned: input?.planned !== false };
        state.expenses.push(expense); save(); render();
        return { id: expense.id, status: 'created', amount: expense.amount, category: expense.category };
      }
    });

    register({
      name: 'record_income',
      title: 'Gelir kaydet',
      description: 'Düzenli gelir, ekstra para veya yatırım getirisini Kişisel Merkez bütçesine ekler.',
      inputSchema: { type: 'object', properties: { amount: { type: 'number', exclusiveMinimum: 0 }, date: { type: 'string', description: 'YYYY-AA-GG' }, source: { type: 'string', minLength: 1, maxLength: 60 }, kind: { type: 'string', enum: ['regular', 'extra', 'investment'] }, note: { type: 'string', maxLength: 100 } }, required: ['amount', 'date', 'source', 'kind'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const amount = Number(input?.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Tutar sıfırdan büyük olmalı');
        if (!['regular', 'extra', 'investment'].includes(input?.kind)) throw new Error('Gelir türü regular, extra veya investment olmalı');
        const income = { id: id(), amount, date: requireDate(input?.date), source: requireText(input?.source, 'Gelir kaynağı').slice(0, 60), kind: input.kind, note: typeof input?.note === 'string' ? input.note.trim().slice(0, 100) : '' };
        state.incomes.push(income); save(); render();
        return { id: income.id, status: 'created', amount: income.amount, source: income.source, kind: income.kind };
      }
    });

    register({
      name: 'record_sleep',
      title: 'Uyku kaydet',
      description: 'Yatış, kalkış, enerji ve kalite bilgileriyle bir uyku kaydı oluşturur.',
      inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'Uyanılan gün, YYYY-AA-GG' }, bedTime: { type: 'string', description: 'SS:DD' }, wakeTime: { type: 'string', description: 'SS:DD' }, energy: { type: 'number', minimum: 1, maximum: 5 }, quality: { type: 'number', minimum: 1, maximum: 5 } }, required: ['date', 'bedTime', 'wakeTime', 'energy', 'quality'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const bedTime = optionalTime(input?.bedTime); const wakeTime = optionalTime(input?.wakeTime);
        if (!bedTime || !wakeTime) throw new Error('Yatış ve kalkış saati gerekli');
        const energy = Number(input?.energy); const quality = Number(input?.quality);
        if (![energy, quality].every(x => Number.isFinite(x) && x >= 1 && x <= 5)) throw new Error('Enerji ve kalite 1 ile 5 arasında olmalı');
        const sleep = { id: id(), date: requireDate(input?.date), bedTime, wakeTime, energy, quality, duration: sleepDuration(bedTime, wakeTime) };
        state.sleepEntries = state.sleepEntries.filter(x => x.date !== sleep.date); state.sleepEntries.push(sleep); save(); render();
        return { id: sleep.id, status: 'created', date: sleep.date, durationMinutes: sleep.duration };
      }
    });
  }

  view.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.add) {
      const date = button.dataset.date;
      if (button.dataset.add === 'task') openTaskForm(null, date);
      if (button.dataset.add === 'workout') openWorkoutForm(null, date);
      if (button.dataset.add === 'expense') openExpenseForm(null, date);
      if (button.dataset.add === 'income') openIncomeForm(null, date);
      if (button.dataset.add === 'recurring-expense') openRecurringExpenseForm();
      if (button.dataset.add === 'sleep') openSleepForm();
    }
    if (button.dataset.toggleTask) { const item = state.tasks.find(x => x.id === button.dataset.toggleTask); if (item) { item.done = !item.done; save(); render(); showToast(item.done ? 'Görev tamamlandı' : 'Görev yeniden açıldı'); } }
    if (button.dataset.toggleWorkout) { const item = state.workouts.find(x => x.id === button.dataset.toggleWorkout); if (item) { item.done = !item.done; save(); render(); showToast(item.done ? 'Antrenman tamamlandı' : 'Antrenman yeniden açıldı'); } }
    if (button.dataset.workoutDetail) { const item = state.workouts.find(x => x.id === button.dataset.workoutDetail); if (item) openWorkoutDetail(item); }
    if (button.dataset.editTask) openTaskForm(state.tasks.find(x => x.id === button.dataset.editTask));
    if (button.dataset.editWorkout) openWorkoutForm(state.workouts.find(x => x.id === button.dataset.editWorkout));
    if (button.dataset.editExpense) openExpenseForm(state.expenses.find(x => x.id === button.dataset.editExpense));
    if (button.dataset.editIncome) openIncomeForm(state.incomes.find(x => x.id === button.dataset.editIncome));
    if (button.dataset.editRecurringExpense) openRecurringExpenseForm(state.recurringExpenses.find(x => x.id === button.dataset.editRecurringExpense));
    if (button.dataset.toggleRecurringPaid) { const item = state.recurringExpenses.find(x => x.id === button.dataset.toggleRecurringPaid); if (item) toggleRecurringPaid(item); }
    if (button.dataset.editSleep) openSleepForm(state.sleepEntries.find(x => x.id === button.dataset.editSleep));
    if (button.dataset.month) { calendarCursor.setMonth(calendarCursor.getMonth() + Number(button.dataset.month)); selectedCalendarDate = toISO(calendarCursor); renderCalendar(); }
    if (button.dataset.calendarDate) { selectedCalendarDate = button.dataset.calendarDate; renderCalendar(); }
    if (button.dataset.planTab) { planTab = button.dataset.planTab; renderPlans(); }
    if (button.hasAttribute('data-open-routine')) openRoutine();
    if (button.hasAttribute('data-settings-sleep')) openSleepSettings();
    if (button.hasAttribute('data-settings-budget')) openBudgetSettings();
    if (button.hasAttribute('data-open-evaluation')) openEvaluation();
    if (button.hasAttribute('data-open-week-review')) openWeekReview();
    if (button.hasAttribute('data-open-budget-evaluation')) openBudgetEvaluation();
  });

  $$('[data-route]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
  $('#settings-button').addEventListener('click', openSettings);
  $('#sheet-close').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', event => { if (event.target === sheetBackdrop) closeSheet(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sheetBackdrop.hidden) closeSheet(); });

  fab.addEventListener('click', () => { quickMenu.hidden = !quickMenu.hidden; fab.setAttribute('aria-expanded', String(!quickMenu.hidden)); });
  $$('[data-quick]').forEach(button => button.addEventListener('click', () => { quickMenu.hidden = true; fab.setAttribute('aria-expanded', 'false'); const type = button.dataset.quick; if (type === 'task') openTaskForm(); if (type === 'workout') openWorkoutForm(); if (type === 'expense') openExpenseForm(); if (type === 'income') openIncomeForm(); if (type === 'sleep') openSleepForm(); }));
  document.addEventListener('click', event => { if (!quickMenu.hidden && !quickMenu.contains(event.target) && !fab.contains(event.target)) { quickMenu.hidden = true; fab.setAttribute('aria-expanded', 'false'); } });

  $('#backup-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) importBackup(file); event.target.value = ''; });

  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker kaydedilemedi', error)));
  applyTheme();
  render();
  registerWebMCP();
  checkReminders();
  setInterval(checkReminders, 30000);
})();

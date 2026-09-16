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
      settings: { theme: 'auto', monthlyBudget: 20000, startingSavings: 0, bankSavings: 0, monthlySalary: 0, monthlyStatements: {}, savingsTarget: 100000, bedtime: '23:30', wakeTime: '07:00', notifications: false, lastBackupAt: '', pinHash: '' },
      tasks: [
        { id: id(), title: 'Bu haftanın 3 önceliğini belirle', date: today, time: '09:00', priority: true, done: false, notes: '' },
        { id: id(), title: 'Kişisel Merkez’i ana ekrana ekle', date: today, time: '20:00', priority: false, done: false, notes: 'Safari’de Paylaş → Ana Ekrana Ekle' }
      ],
      workouts: [
        { id: id(), title: 'Üst vücut', date: today, time: '18:30', duration: 45, exercises: 'Şınav — 4×10\nRow — 4×10\nOmuz press — 3×12\nBiceps curl — 3×12', exerciseItems: [{ id: id(), name: 'Şınav — 4×10', done: false }, { id: id(), name: 'Row — 4×10', done: false }, { id: id(), name: 'Omuz press — 3×12', done: false }, { id: id(), name: 'Biceps curl — 3×12', done: false }], done: false },
        { id: id(), title: 'Alt vücut', date: addDays(today, 2), time: '18:30', duration: 45, exercises: 'Squat — 4×10\nLunge — 3×10\nHip hinge — 4×8\nCalf raise — 3×15', exerciseItems: [{ id: id(), name: 'Squat — 4×10', done: false }, { id: id(), name: 'Lunge — 3×10', done: false }, { id: id(), name: 'Hip hinge — 4×8', done: false }, { id: id(), name: 'Calf raise — 3×15', done: false }], done: false }
      ],
      workoutTemplates: [],
      expenses: [],
      incomes: [],
      recurringExpenses: [],
      recurringTasks: [],
      inboxNotes: [],
      goals: [],
      sleepEntries: [],
      weeklyReviews: [],
      notified: {}
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === 1) return normalizeState(saved);
    } catch (error) { console.warn('Kayıt okunamadı', error); }
    return defaultState();
  }

  function normalizeState(saved) {
    const defaults = defaultState();
    const savedSettings = saved.settings || {};
    const settings = { ...defaults.settings, ...savedSettings };
    if (savedSettings.bankSavings == null) settings.bankSavings = Number(savedSettings.startingSavings || 0);
    if (!settings.monthlyStatements || typeof settings.monthlyStatements !== 'object') settings.monthlyStatements = {};
    return {
      ...defaults,
      ...saved,
      settings,
      workoutTemplates: Array.isArray(saved.workoutTemplates) ? saved.workoutTemplates : [],
      recurringExpenses: Array.isArray(saved.recurringExpenses) ? saved.recurringExpenses : [],
      recurringTasks: Array.isArray(saved.recurringTasks) ? saved.recurringTasks : [],
      inboxNotes: Array.isArray(saved.inboxNotes) ? saved.inboxNotes : [],
      goals: Array.isArray(saved.goals) ? saved.goals : []
    };
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

  function recurringTaskMatches(rule, date) {
    if (toISO(date) < (rule.startDate || todayISO())) return false;
    if (rule.schedule === 'daily') return true;
    if (String(rule.schedule).startsWith('weekly-')) return date.getDay() === Number(String(rule.schedule).split('-')[1]);
    return rule.schedule === 'monthly' && date.getDate() === clamp(Number(rule.monthDay) || 1, 1, 31);
  }

  function syncRecurringTasks() {
    let changed = false;
    const start = new Date(); start.setHours(12, 0, 0, 0);
    state.recurringTasks.forEach(rule => {
      for (let offset = 0; offset < 15; offset++) {
        const date = new Date(start); date.setDate(date.getDate() + offset);
        if (!recurringTaskMatches(rule, date)) continue;
        const iso = toISO(date);
        if ((rule.skippedDates || []).includes(iso)) continue;
        if (state.tasks.some(task => task.recurringRuleId === rule.id && task.date === iso)) continue;
        state.tasks.push({ id: id(), title: rule.title, date: iso, time: rule.time || '', priority: Boolean(rule.priority), done: false, notes: 'Tekrarlayan görev', recurringRuleId: rule.id });
        changed = true;
      }
    });
    if (changed) save();
  }

  syncRecurringTasks();

  function syncWorkoutTemplates() {
    let changed = false;
    const start = new Date(); start.setHours(12, 0, 0, 0);
    state.workoutTemplates.forEach(template => {
      for (let offset = 0; offset < 29; offset++) {
        const date = new Date(start); date.setDate(date.getDate() + offset);
        if (date.getDay() !== Number(template.weekday)) continue;
        const iso = toISO(date);
        if ((template.skippedDates || []).includes(iso)) continue;
        if (state.workouts.some(workout => workout.templateId === template.id && workout.date === iso)) continue;
        const names = String(template.exercises || '').split(/\r?\n/).map(name => name.trim()).filter(Boolean);
        state.workouts.push({ id: id(), title: template.title, date: iso, time: template.time || '18:30', duration: Number(template.duration) || 45, exercises: names.join('\n'), exerciseItems: names.map(name => ({ id: id(), name, done: false })), done: false, templateId: template.id });
        changed = true;
      }
    });
    if (changed) save();
  }

  syncWorkoutTemplates();

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
      sleep: [...state.sleepEntries].filter(item => item.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] || null,
      expenses: state.expenses.filter(item => item.date === today)
    };
  }

  function backupIsDue() {
    if (!state.settings.lastBackupAt) return true;
    const last = new Date(state.settings.lastBackupAt);
    return Number.isNaN(last.getTime()) || (Date.now() - last.getTime()) > 30 * 86400000;
  }

  function upcomingPayments(days = 7) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + days);
    const candidates = [];
    [0, 1].forEach(monthOffset => {
      const month = new Date(start.getFullYear(), start.getMonth() + monthOffset, 1);
      const monthKey = currentMonthKey(month);
      const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      state.recurringExpenses.forEach(item => {
        if ((item.paidMonths || []).includes(monthKey)) return;
        const due = new Date(month.getFullYear(), month.getMonth(), Math.min(lastDay, clamp(Number(item.dueDay) || 1, 1, 31)));
        if ((monthOffset === 0 && due < start) || (due >= start && due <= end)) candidates.push({ item, due });
      });
    });
    return candidates.sort((a, b) => a.due - b.due);
  }

  function renderInboxNotes() {
    const notes = [...state.inboxNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    if (!notes.length) return '';
    return `<div class="row between"><div class="section-label">Hızlı notlar</div><button class="button" type="button" data-add="inbox">+ Not</button></div><div class="inbox-list">${notes.map(note => `<article class="card"><div class="row"><div class="module-icon">•</div><div class="grow"><p class="item-title">${esc(note.text)}</p><p class="item-detail">${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(note.createdAt))}</p></div></div><div class="action-grid"><button class="button" type="button" data-inbox-to-task="${note.id}">Göreve çevir</button><button class="button danger" type="button" data-delete-inbox="${note.id}">Sil</button></div></article>`).join('')}</div>`;
  }

  function renderToday() {
    const items = todayItems();
    const priorities = items.tasks.filter(item => item.priority).slice(0, 3);
    const focus = priorities.find(item => !item.done) || items.tasks.find(item => !item.done);
    const doneCount = priorities.filter(item => item.done).length;
    const todaySpend = items.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const payments = upcomingPayments();
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

      <div class="quick-actions"><button class="button" type="button" data-add="inbox">• Hızlı not</button><button class="button" type="button" data-open-week-planner>◫ Haftayı planla</button></div>
      ${backupIsDue() ? `<article class="card reminder-card"><div class="row"><div class="module-icon">⇩</div><div class="grow"><p class="item-title">Yedek zamanı</p><p class="item-detail">Kayıtlarını aylık olarak indirip iCloud Drive veya Google Drive'a koy.</p></div><button class="button" type="button" data-export>Yedekle</button></div></article>` : ''}
      ${renderInboxNotes()}

      <div class="section-label">Bugünün planı</div>
      ${items.tasks.length ? items.tasks.map(taskCard).join('') : emptyInline('✓', 'Bugün görev yok', 'Hızlıca bir öncelik ekleyebilirsin.', 'Görev ekle', 'task')}

      ${items.workouts.length ? items.workouts.map(workoutCard).join('') : `<article class="card"><div class="row"><div class="module-icon">↗</div><div class="grow"><p class="item-title">Bugün spor planı yok</p><p class="item-detail">Dinlenme günü olabilir.</p></div><button class="button" type="button" data-add="workout">Planla</button></div></article>`}

      <article class="card">
        <div class="row between">
          <div class="row grow"><div class="module-icon">☾</div><div class="grow"><p class="item-title">Uyku kaydı</p><p class="item-detail">${items.sleep ? `Son kayıt: ${formatDuration(items.sleep.duration)} · Enerji ${items.sleep.energy}/5` : 'Bugün kaç saat uyuduğunu ekle'}</p></div></div>
          <button class="button" type="button" data-add="sleep">Uyku ekle</button>
        </div>
      </article>

      <article class="card">
        <div class="row between">
          <div class="row grow"><div class="module-icon">₺</div><div class="grow"><p class="item-title">Bugünkü harcama</p><p class="item-detail">${money(todaySpend)} ayrıntılı harcama kaydı</p></div></div>
          <button class="button" type="button" data-add="expense">Ekle</button>
        </div>
      </article>
      ${payments.length ? `<article class="card"><div class="row between"><div><p class="item-title">Yaklaşan ödemeler</p><p class="item-detail">7 gün içindeki ve geciken ${payments.length} kalem</p></div><button class="button" type="button" data-open-budget>Gör</button></div><div class="compact-list">${payments.slice(0, 4).map(({ item, due }) => `<div class="compact-row"><span class="grow">${esc(item.title)}<small>${due < new Date().setHours(0,0,0,0) ? 'Gecikti' : shortDate(toISO(due))}</small></span><strong>${money(item.amount)}</strong></div>`).join('')}</div></article>` : ''}
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
    const rules = [...state.recurringTasks].sort((a, b) => a.title.localeCompare(b.title, 'tr'));
    return `<div class="row between"><div class="section-label">Görevler</div><div class="row"><button class="button" type="button" data-open-week-planner>Haftayı planla</button><button class="button" type="button" data-add="task">+ Görev</button></div></div>
      <div class="row between"><div><div class="section-label">Tekrarlayan görevler</div><p class="item-detail">Rutin işler takvime otomatik eklenir</p></div><button class="button" type="button" data-add="recurring-task">+ Ekle</button></div>
      ${rules.length ? rules.map(rule => `<article class="card"><div class="row"><div class="module-icon">↻</div><div class="grow"><p class="item-title">${esc(rule.title)}</p><p class="item-detail">${recurringScheduleLabel(rule)} · ${esc(rule.time || 'Saat yok')}${rule.priority ? ' · Öncelik' : ''}</p></div><button class="icon-button" type="button" data-edit-recurring-task="${rule.id}">···</button></div></article>`).join('') : `<article class="card empty-state"><div class="empty-icon">↻</div><h3>Tekrarlayan görev yok</h3><p>Haftalık planlama veya düzenli kontrolleri bir kez kur.</p><button class="button" type="button" data-add="recurring-task">Tekrarlayan görev ekle</button></article>`}
      <div class="section-label">Tarihli görevler</div>
      ${items.length ? items.map(item => `<article class="card ${item.done ? 'is-done' : ''}"><div class="row"><button class="check-button ${item.done ? 'done' : ''}" type="button" data-toggle-task="${item.id}">✓</button><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.time || 'Saat yok')}${item.priority ? ' · Öncelik' : ''}${item.recurringRuleId ? ' · Tekrarlayan' : ''}</p></div><button class="icon-button" type="button" data-edit-task="${item.id}">···</button></div></article>`).join('') : emptyInline('✓', 'Görev listesi boş', 'İlk hedefini ya da yapman gereken işi ekle.', 'Görev ekle', 'task')}`;
  }

  function recurringScheduleLabel(rule) {
    const weekly = { 0: 'Her pazar', 1: 'Her pazartesi', 2: 'Her salı', 3: 'Her çarşamba', 4: 'Her perşembe', 5: 'Her cuma', 6: 'Her cumartesi' };
    if (rule.schedule === 'daily') return 'Her gün';
    if (rule.schedule === 'monthly') return `Her ayın ${rule.monthDay || 1}. günü`;
    return weekly[Number(String(rule.schedule).split('-')[1])] || 'Her hafta';
  }

  function weekdayLabel(weekday) {
    return ['Her pazar', 'Her pazartesi', 'Her salı', 'Her çarşamba', 'Her perşembe', 'Her cuma', 'Her cumartesi'][Number(weekday)] || 'Her hafta';
  }

  function renderWorkoutPlan() {
    const items = [...state.workouts].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const templates = [...state.workoutTemplates].sort((a, b) => Number(a.weekday) - Number(b.weekday) || String(a.time).localeCompare(String(b.time)));
    return `<div class="row between"><div><div class="section-label">Haftalık programım</div><p class="item-detail">Bir kez kur; her hafta takvime otomatik gelsin</p></div><button class="button" type="button" data-add="workout-template">+ Program</button></div>
      ${templates.length ? templates.map(template => { const exerciseCount = String(template.exercises || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).length; return `<article class="card"><div class="row"><div class="module-icon">↻</div><div class="grow"><p class="item-title">${esc(template.title)}</p><p class="item-detail">${weekdayLabel(template.weekday)} · ${esc(template.time || 'Saat yok')} · ${Number(template.duration) || 45} dk · ${exerciseCount} hareket</p></div><button class="icon-button" type="button" data-edit-workout-template="${template.id}">···</button></div></article>`; }).join('') : `<article class="card empty-state"><div class="empty-icon">↻</div><h3>Haftalık program kurulmamış</h3><p>Aynı antrenmanı her hafta yeniden yazmadan uygula.</p><button class="button" type="button" data-add="workout-template">Haftalık program ekle</button></article>`}
      <div class="row between"><div class="section-label">Takvimdeki antrenmanlar</div><button class="button" type="button" data-add="workout">+ Tek seferlik</button></div>
      ${items.length ? items.map(item => { const exercises = workoutExercises(item); const completed = exercises.filter(x => x.done).length; return `<article class="card ${item.done ? 'is-done' : ''}"><div class="row"><div class="module-icon">↗</div><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.time || 'Saat yok')} · ${item.duration} dk · ${completed}/${exercises.length} hareket${item.templateId ? ' · Haftalık' : ''}</p></div><button class="button ${item.done ? 'good' : ''}" type="button" data-workout-detail="${item.id}">${item.done ? 'Bitti' : 'Detay'}</button><button class="icon-button" type="button" data-edit-workout="${item.id}">···</button></div>${exercises.length ? `<div class="progress-track good"><span style="width:${completed / exercises.length * 100}%"></span></div>` : ''}</article>`; }).join('') : emptyInline('↗', 'Takvimde antrenman yok', 'Haftalık bir program kur veya tek seferlik antrenman ekle.', 'Antrenman ekle', 'workout')}`;
  }

  function renderSleepPlan() {
    const recent = [...state.sleepEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const avg = average(recent.map(x => x.duration));
    return `<div class="mini-grid"><div class="stat-card"><div class="stat-label">Son 7 kayıt</div><div class="stat-value">${formatDuration(avg)}</div><div class="stat-note">Ortalama süre</div></div><div class="stat-card"><div class="stat-label">Enerji</div><div class="stat-value">${recent.length ? `${average(recent.map(x => Number(x.energy))).toFixed(1)} / 5` : '—'}</div><div class="stat-note">Sabah hissi</div></div></div>
      <div class="row between"><div><div class="section-label">Uyku kayıtları</div><p class="item-detail">Sadece toplam süre, enerji ve kalite</p></div><button class="button" type="button" data-add="sleep">+ Uyku ekle</button></div>
      ${recent.length ? recent.map(item => `<article class="card"><div class="row"><div class="module-icon">☾</div><div class="grow"><p class="item-title">${shortDate(item.date)} · ${formatDuration(item.duration)}</p><p class="item-detail">Enerji ${item.energy}/5 · Kalite ${item.quality}/5</p></div><button class="icon-button" type="button" data-edit-sleep="${item.id}">···</button></div></article>`).join('') : emptyInline('☾', 'Henüz uyku kaydı yok', 'Uyuduğun toplam süreyi eklemen yeterli.', 'İlk kaydı ekle', 'sleep')}`;
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

  function recurringTypeLabel(type) { return ({ fixed: 'Sabit gider', bill: 'Fatura / abonelik', statement: 'Eski ekstre kaydı' })[type] || 'Düzenli gider'; }

  function recurringDueLabel(item, paid) {
    if (paid) return 'Ödendi';
    const today = new Date();
    const dueDay = clamp(Number(item.dueDay) || 1, 1, 31);
    return today.getDate() > dueDay ? `Gecikti · ${dueDay}. gün` : `${dueDay}. gün`;
  }

  function renderBudgetPlan() {
    const current = financialMonth();
    const items = [...current.incomes.map(item => ({ ...item, transactionType: 'income' })), ...current.expenses.map(item => ({ ...item, transactionType: 'expense' }))].sort((a, b) => b.date.localeCompare(a.date));
    const bankSavings = Number(state.settings.bankSavings || 0);
    const salary = Number(state.settings.monthlySalary || 0);
    const target = Number(state.settings.savingsTarget || 0);
    const monthKey = currentMonthKey();
    const statement = Number(state.settings.monthlyStatements?.[monthKey] || 0);
    const recurring = [...state.recurringExpenses].sort((a, b) => Number(a.dueDay) - Number(b.dueDay));
    const regularRecurring = recurring.filter(item => item.type !== 'statement');
    const recurringTotal = regularRecurring.filter(item => !item.includedInStatement).reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringInStatement = regularRecurring.filter(item => item.includedInStatement).reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringTrackedTotal = regularRecurring.reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringPaid = regularRecurring.filter(item => !item.includedInStatement && (item.paidMonths || []).includes(monthKey)).reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringPaidAll = regularRecurring.filter(item => (item.paidMonths || []).includes(monthKey)).reduce((sum, item) => sum + Number(item.amount), 0);
    const monthRemainder = salary - recurringTotal - statement;
    const projectedSavings = bankSavings + monthRemainder;
    return `<article class="finance-hero"><div class="row between"><div><div class="stat-label">Bankadaki birikim</div><div class="finance-balance ${bankSavings < 0 ? 'money-negative' : ''}">${money(bankSavings)}</div><div class="finance-target">Hedef: ${money(target)} · %${target ? Math.round(clamp(bankSavings / target * 100, 0, 100)) : 0} tamamlandı</div></div><button class="button" type="button" data-settings-budget>Finansı güncelle</button></div><div class="progress-track good"><span style="width:${target ? clamp(bankSavings / target * 100, 0, 100) : 0}%"></span></div></article>
      <div class="budget-core-grid">
        <div class="finance-tile"><div class="stat-label">Aylık maaş</div><div class="stat-value money-positive">${money(salary)}</div></div>
        <div class="finance-tile"><div class="stat-label">Ekstre dışı düzenli</div><div class="stat-value">${money(recurringTotal)}</div><div class="stat-note">${money(recurringPaid)} ödendi</div></div>
        <div class="finance-tile"><div class="stat-label">Bu ayki ekstre</div><div class="stat-value">${money(statement)}</div></div>
        <div class="finance-tile"><div class="stat-label">Ay sonunda kalacak</div><div class="stat-value ${monthRemainder >= 0 ? 'money-positive' : 'money-negative'}">${money(monthRemainder)}</div></div>
      </div>
      <article class="card forecast-card"><div class="row between"><div><p class="item-title">Tahmini toplam birikim</p><p class="item-detail">Banka birikimi + maaş − düzenli giderler − ekstre</p></div><strong class="${projectedSavings >= 0 ? 'money-positive' : 'money-negative'}">${money(projectedSavings)}</strong></div></article>
      <div class="row between"><div><div class="section-label">Aylık düzenli giderler</div><p class="item-detail">Abonelikler, faturalar ve her ay tekrarlayan ödemeler</p></div><button class="button" type="button" data-add="recurring-expense">+ Ekle</button></div>
      ${recurring.length ? `<article class="card recurring-summary"><div class="row between"><div><p class="item-title">Takip edilen ${money(recurringTrackedTotal)}</p><p class="item-detail">${money(recurringTotal)} ekstre dışında · ${money(recurringInStatement)} ekstre içinde</p></div><strong>%${recurringTrackedTotal ? Math.round(recurringPaidAll / recurringTrackedTotal * 100) : 0}</strong></div><div class="progress-track good"><span style="width:${recurringTrackedTotal ? recurringPaidAll / recurringTrackedTotal * 100 : 0}%"></span></div></article><div class="recurring-list">${recurring.map(item => { const paid = (item.paidMonths || []).includes(monthKey); const legacyStatement = item.type === 'statement'; return `<article class="card"><div class="row"><div class="module-icon">↻</div><div class="grow"><p class="item-title">${esc(item.title)}</p><p class="item-detail">${recurringTypeLabel(item.type)} · ${esc(item.category)}${legacyStatement ? ' · Hesaba dahil değil' : ` · ${item.includedInStatement ? 'Ekstre içinde' : 'Ekstre dışında'} · <span class="${!paid && new Date().getDate() > Number(item.dueDay) ? 'money-negative' : ''}">${recurringDueLabel(item, paid)}</span>`}</p></div><strong>${money(item.amount)}</strong><button class="icon-button" type="button" data-edit-recurring-expense="${item.id}" aria-label="${esc(item.title)} giderini düzenle">···</button></div>${legacyStatement ? '<p class="item-detail">Yeni toplam ekstre alanına taşıyıp bu kaydı silebilirsin.</p>' : `<button class="button block ${paid ? '' : 'primary'}" type="button" data-toggle-recurring-paid="${item.id}">${paid ? 'Ödemeyi geri al' : 'Ödendi olarak işaretle'}</button>`}</article>`; }).join('')}</div>` : `<article class="card empty-state"><div class="empty-icon">↻</div><h3>Düzenli gider eklenmemiş</h3><p>Abonelik, fatura veya her ay tekrarlayan bir ödemeyi ekle.</p><button class="button" type="button" data-add="recurring-expense">Düzenli gider ekle</button></article>`}
      <div class="row between"><div><div class="section-label">İsteğe bağlı ayrıntılar</div><p class="item-detail">Ek gelir ve tekil harcamalar; ana maaş/ekstre hesabından ayrı tutulur</p></div><div class="row"><button class="button" type="button" data-add="income">+ Ek gelir</button><button class="button" type="button" data-add="expense">+ Harcama</button></div></div>
      ${items.length ? items.map(item => item.transactionType === 'income' ? `<article class="card"><div class="row"><div class="module-icon">＋</div><div class="grow"><p class="item-title">${esc(item.note || item.source)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.source)} · ${incomeKindLabel(item.kind)}</p></div><strong class="money-positive">+${money(item.amount)}</strong><button class="icon-button" type="button" data-edit-income="${item.id}">···</button></div></article>` : `<article class="card"><div class="row"><div class="module-icon">₺</div><div class="grow"><p class="item-title">${esc(item.note || item.category)}</p><p class="item-detail">${shortDate(item.date)} · ${esc(item.category)}${item.planned ? ' · Planlı' : ' · Plansız'}</p></div><strong>−${money(item.amount)}</strong><button class="icon-button" type="button" data-edit-expense="${item.id}">···</button></div></article>`).join('') : `<article class="card empty-state"><div class="empty-icon">₺</div><h3>Ayrıntılı hareket yok</h3><p>Bu alan isteğe bağlıdır; maaş, düzenli gider ve ekstre için kullanman gerekmez.</p></article>`}`;
  }

  function incomeKindLabel(kind) { return ({ regular: 'Düzenli', extra: 'Ekstra', investment: 'Yatırım getirisi' })[kind] || 'Ekstra'; }

  function average(values) { const usable = values.filter(value => Number.isFinite(Number(value))).map(Number); return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : 0; }
  function formatDuration(minutes) { if (!minutes) return '—'; return `${Math.floor(minutes / 60)} sa ${Math.round(minutes % 60)} dk`; }

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
    parts.push(`Bu hafta ayrıntılı kayıtlara eklediğin harcama ${money(m.spend)}.`);
    let focus = 'Gelecek hafta için tek bir net öncelik seç ve takvime saatini koy.';
    if (m.sleepAvg && m.sleepAvg < 420) focus = 'Önce uykuyu düzelt: bu hafta en az dört gece 7 saatlik uyku alanı aç.';
    else if (m.taskTotal && m.taskRate < 60) focus = 'Yeni görev eklemeden önce açık iş sayısını azalt; gelecek haftaya en fazla üç öncelik taşı.';
    else if (m.workoutTotal && m.workoutDone < m.workoutTotal) focus = 'Eksik antrenmanı telafi etmeye çalışma; gelecek haftanın günlerini şimdiden sabitle.';
    return { title: m.taskRate >= 75 ? 'Ritmi koru, bir noktayı iyileştir' : m.taskRate >= 50 ? 'Temel iyi, odağı daralt' : 'Planı sadeleştir ve yeniden başla', body: parts.join(' '), focus, metrics: m };
  }

  function budgetEvaluation() {
    const salary = Number(state.settings.monthlySalary || 0);
    const recurring = state.recurringExpenses.filter(item => item.type !== 'statement' && !item.includedInStatement).reduce((sum, item) => sum + Number(item.amount), 0);
    const statement = Number(state.settings.monthlyStatements?.[currentMonthKey()] || 0);
    const bankSavings = Number(state.settings.bankSavings || 0);
    const remainder = salary - recurring - statement;
    const projected = bankSavings + remainder;
    const detail = salary || recurring || statement ? `Aylık maaşın ${money(salary)}, düzenli giderlerin ${money(recurring)} ve bu ayki toplam ekstren ${money(statement)}. Ay sonunda ${money(remainder)} kalması; banka birikiminin yaklaşık ${money(projected)} olması bekleniyor.` : 'Maaşını, düzenli giderlerini ve bu ayki ekstre toplamını girdiğinde net bir tahmin oluşacak.';
    const suggestion = remainder < 0 ? `Bu ay gelirinden ${money(Math.abs(remainder))} fazla çıkış var. Ekstreyi ve zorunlu olmayan düzenli ödemeleri gözden geçir.` : remainder === 0 ? 'Bu ay gelir ve planlanan çıkış dengede. Ek harcamalar için pay kalmıyor.' : `Ay sonunda kalacak ${money(remainder)} için önceden birikime aktarılacak tutar belirle.`;
    return { title: remainder >= 0 ? 'Aylık plan dengede' : 'Aylık açık görünüyor', detail, suggestion };
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
        <div class="stat-card"><div class="stat-label">Ek harcamalar</div><div class="stat-value">${money(m.spend)}</div><div class="stat-note">Son 7 gün</div></div>
      </div>
      <article class="card"><div class="row between"><div><p class="item-title">Dört haftalık gidişat</p><p class="item-detail">Tamamlanan görev oranı</p></div><span class="muted">↗</span></div><div class="bar-chart">${weeks.map((week, index) => `<div class="bar-column"><span class="bar-value">%${week.taskRate}</span><span class="bar" style="height:${Math.max(5, week.taskRate / maxRate * 100)}%"></span><span class="bar-label">${index === 3 ? 'Bu hafta' : `${4 - index} hf.`}</span></div>`).join('')}</div></article>
      <article class="card"><p class="item-title">Haftanın değerlendirmesi</p><p class="item-detail">Görev, spor, uyku ve bütçe kayıtlarından anında hazırlanır.</p><div class="action-grid"><button class="button primary" type="button" data-open-evaluation>Değerlendirmeyi aç</button><button class="button" type="button" data-open-week-review>Haftayı değerlendir</button></div></article>
      <article class="card"><p class="item-title">Bütçe değerlendirmesi</p><p class="item-detail">Maaş, düzenli giderler, ekstre ve banka birikimini birlikte yorumlar.</p><button class="button block" style="margin-top:12px" type="button" data-open-budget-evaluation>Bütçeyi değerlendir</button></article>
      <div class="row between"><div class="section-label">Hedeflerim</div><button class="button" type="button" data-add="goal">+ Hedef</button></div>
      ${state.goals.length ? state.goals.map(goal => { const percent = clamp(Number(goal.target) ? Number(goal.current) / Number(goal.target) * 100 : 0, 0, 100); return `<article class="card"><div class="row between"><div><p class="item-title">${esc(goal.title)}</p><p class="item-detail">${esc(String(goal.current))} / ${esc(String(goal.target))} ${esc(goal.unit || '')}</p></div><button class="icon-button" type="button" data-edit-goal="${goal.id}">···</button></div><div class="row between goal-progress"><div class="progress-track good grow"><span style="width:${percent}%"></span></div><strong>%${Math.round(percent)}</strong></div></article>`; }).join('') : `<article class="card empty-state"><div class="empty-icon">◎</div><h3>Hedef eklenmemiş</h3><p>Birikim, spor veya kişisel bir hedefi sayısal olarak takip et.</p><button class="button" type="button" data-add="goal">Hedef ekle</button></article>`}
      ${state.weeklyReviews.length ? `<div class="section-label">Kayıtlı değerlendirmeler</div>${[...state.weeklyReviews].sort((a,b)=>b.weekStart.localeCompare(a.weekStart)).slice(0,3).map(r => `<article class="card"><p class="item-title">${shortDate(r.weekStart)} haftası</p><p class="item-detail"><strong>İyi:</strong> ${esc(r.good || '—')}<br><strong>Zorluk:</strong> ${esc(r.hard || '—')}<br><strong>Odak:</strong> ${esc(r.focus || '—')}</p></article>`).join('')}` : ''}
    </div>`;
  }

  function formActions(editing) { return `<div class="form-actions">${editing ? '<button class="button danger" type="button" data-delete-item>Sil</button>' : ''}<button class="button primary" type="submit">Kaydet</button></div>`; }

  function openTaskForm(existing, presetDate, presetTitle = '', inboxId = '') {
    const item = existing || { title: presetTitle, date: presetDate || todayISO(), time: '09:00', priority: false, notes: '' };
    openSheet('Plan', existing ? 'Görevi düzenle' : 'Görev ekle', `<form class="form" id="item-form">
      <label class="field">Görev<input name="title" maxlength="100" required value="${esc(item.title)}" placeholder="Ne yapacaksın?"></label>
      <div class="form-row"><label class="field">Tarih<input name="date" type="date" required value="${item.date}"></label><label class="field">Saat<input name="time" type="time" value="${item.time || ''}"></label></div>
      <label class="checkbox-field"><input name="priority" type="checkbox" ${item.priority ? 'checked' : ''}> Bugünün önceliklerine ekle</label>
      <label class="field">Kısa not<input name="notes" maxlength="140" value="${esc(item.notes || '')}" placeholder="İstersen boş bırak"></label>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), title: data.get('title').trim(), date: data.get('date'), time: data.get('time'), priority: data.get('priority') === 'on', notes: data.get('notes').trim(), done: existing?.done || false, recurringRuleId: existing?.recurringRuleId }; if (existing) Object.assign(existing, next); else state.tasks.push(next); if (inboxId) state.inboxNotes = state.inboxNotes.filter(note => note.id !== inboxId); save(); closeSheet(); render(); showToast('Görev kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { if (existing.recurringRuleId) { const rule = state.recurringTasks.find(x => x.id === existing.recurringRuleId); if (rule) rule.skippedDates = [...new Set([...(rule.skippedDates || []), existing.date])]; } state.tasks = state.tasks.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Görev silindi'); });
    });
  }

  function openRecurringTaskForm(existing) {
    const item = existing || { title: '', schedule: 'weekly-1', monthDay: 1, startDate: todayISO(), time: '09:00', priority: false };
    const schedules = [['daily','Her gün'],['weekly-1','Her pazartesi'],['weekly-2','Her salı'],['weekly-3','Her çarşamba'],['weekly-4','Her perşembe'],['weekly-5','Her cuma'],['weekly-6','Her cumartesi'],['weekly-0','Her pazar'],['monthly','Her ay']];
    openSheet('Plan', existing ? 'Tekrarlayan görevi düzenle' : 'Tekrarlayan görev ekle', `<form class="form" id="recurring-task-form"><label class="field">Görev<input name="title" maxlength="100" required value="${esc(item.title)}" placeholder="Haftayı planla, faturaları kontrol et..."></label><div class="form-row"><label class="field">Tekrar<select name="schedule">${schedules.map(([value,label]) => `<option value="${value}" ${item.schedule === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">Aylıksa ayın günü<input name="monthDay" type="number" min="1" max="31" value="${item.monthDay || 1}"></label></div><div class="form-row"><label class="field">Başlangıç<input name="startDate" type="date" required value="${item.startDate || todayISO()}"></label><label class="field">Saat<input name="time" type="time" value="${item.time || ''}"></label></div><label class="checkbox-field"><input name="priority" type="checkbox" ${item.priority ? 'checked' : ''}> Oluşan görevleri öncelik yap</label>${formActions(Boolean(existing))}</form>`, root => {
      $('#recurring-task-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), title: data.get('title').trim(), schedule: data.get('schedule'), monthDay: Number(data.get('monthDay')), startDate: data.get('startDate'), time: data.get('time'), priority: data.get('priority') === 'on', skippedDates: existing?.skippedDates || [] }; if (existing) { Object.assign(existing, next); state.tasks = state.tasks.filter(task => !(task.recurringRuleId === existing.id && !task.done && task.date >= todayISO())); } else state.recurringTasks.push(next); syncRecurringTasks(); save(); closeSheet(); render(); showToast('Tekrarlayan görev kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.recurringTasks = state.recurringTasks.filter(rule => rule.id !== existing.id); state.tasks = state.tasks.filter(task => !(task.recurringRuleId === existing.id && !task.done && task.date >= todayISO())); save(); closeSheet(); render(); showToast('Tekrarlayan görev silindi'); });
    });
  }

  function openInboxForm() {
    openSheet('Hızlı yakala', 'Aklındakini yaz', `<form class="form" id="inbox-form"><label class="field">Not<textarea name="text" maxlength="300" required placeholder="Sonra düzenlersin; şimdi kısaca yaz."></textarea></label><button class="button primary block" type="submit">Nota ekle</button></form>`, root => {
      $('#inbox-form', root).addEventListener('submit', event => { event.preventDefault(); const text = new FormData(event.currentTarget).get('text').trim(); state.inboxNotes.push({ id: id(), text, createdAt: new Date().toISOString() }); save(); closeSheet(); render(); showToast('Hızlı not eklendi'); });
    });
  }

  function openWeekPlanner() {
    const monday = startOfWeek(); monday.setDate(monday.getDate() + 7);
    openSheet('3 dakikalık plan', 'Gelecek haftayı kur', `<form class="form" id="week-planner-form"><label class="field">Haftanın başlangıcı<input name="startDate" type="date" required value="${toISO(monday)}"></label><label class="field">Üç öncelik <span class="small">Her satıra bir tane</span><textarea name="priorities" maxlength="300" placeholder="En önemli iş&#10;İkinci öncelik&#10;Üçüncü öncelik"></textarea></label><fieldset class="choice-field"><legend>Spor günleri</legend><div class="choice-grid">${['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map((day,index) => `<label><input type="checkbox" name="workoutDay" value="${index}"><span>${day}</span></label>`).join('')}</div></fieldset><p class="sheet-copy">Kayıtlı düzenli ödemelerin yaklaşınca ana ekranda otomatik görünür.</p><button class="button primary block" type="submit">Haftayı oluştur</button></form>`, root => {
      $('#week-planner-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const startDate = data.get('startDate'); const priorities = data.get('priorities').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 3); priorities.forEach((title,index) => state.tasks.push({ id: id(), title, date: addDays(startDate, index * 2), time: '09:00', priority: true, done: false, notes: 'Haftalık plan' })); data.getAll('workoutDay').forEach(day => { const date = addDays(startDate, Number(day)); if (!state.workouts.some(x => x.date === date)) state.workouts.push({ id: id(), title: 'Antrenman', date, time: '18:30', duration: 45, exercises: '', exerciseItems: [], done: false }); }); save(); closeSheet(); render(); showToast('Gelecek hafta hazır'); });
    });
  }

  function openGoalForm(existing) {
    const item = existing || { title: '', current: 0, target: 1, unit: '' };
    openSheet('Hedef', existing ? 'Hedefi güncelle' : 'Hedef ekle', `<form class="form" id="goal-form"><label class="field">Hedef adı<input name="title" maxlength="80" required value="${esc(item.title)}" placeholder="100.000 TL birikim, 12 antrenman..."></label><div class="form-row"><label class="field">Mevcut<input name="current" type="number" step="0.01" required value="${item.current}"></label><label class="field">Hedef<input name="target" type="number" min="0.01" step="0.01" required value="${item.target}"></label></div><label class="field">Birim<input name="unit" maxlength="20" value="${esc(item.unit || '')}" placeholder="TL, antrenman, saat..."></label>${formActions(Boolean(existing))}</form>`, root => {
      $('#goal-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), title: data.get('title').trim(), current: Number(data.get('current')), target: Number(data.get('target')), unit: data.get('unit').trim() }; if (existing) Object.assign(existing, next); else state.goals.push(next); save(); closeSheet(); render(); showToast('Hedef kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.goals = state.goals.filter(goal => goal.id !== existing.id); save(); closeSheet(); render(); showToast('Hedef silindi'); });
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
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const exerciseNames = data.get('exercises').split(/\r?\n/).map(name => name.trim()).filter(Boolean); const exerciseItems = exerciseNames.map(name => { const previous = existingExercises.find(x => x.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')); return { id: previous?.id || id(), name, done: previous?.done || false }; }); const movedFromTemplateDate = existing?.templateId && existing.date !== data.get('date'); if (movedFromTemplateDate) { const template = state.workoutTemplates.find(x => x.id === existing.templateId); if (template) template.skippedDates = [...new Set([...(template.skippedDates || []), existing.date])]; } const next = { id: existing?.id || id(), title: data.get('title').trim(), date: data.get('date'), time: data.get('time'), duration: Number(data.get('duration')), exercises: exerciseNames.join('\n'), exerciseItems, done: exerciseItems.length ? exerciseItems.every(x => x.done) : (existing?.done || false), ...(existing?.templateId && !movedFromTemplateDate ? { templateId: existing.templateId } : {}) }; if (existing) { if (movedFromTemplateDate) delete existing.templateId; Object.assign(existing, next); } else state.workouts.push(next); save(); closeSheet(); render(); showToast('Antrenman kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { if (existing.templateId) { const template = state.workoutTemplates.find(x => x.id === existing.templateId); if (template) template.skippedDates = [...new Set([...(template.skippedDates || []), existing.date])]; } state.workouts = state.workouts.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Antrenman silindi'); });
    });
  }

  function openWorkoutTemplateForm(existing) {
    const item = existing || { title: '', weekday: 1, time: '18:30', duration: 45, exercises: '', skippedDates: [] };
    openSheet('Haftalık spor döngüsü', existing ? 'Programı düzenle' : 'Program ekle', `<form class="form" id="workout-template-form">
      <label class="field">Antrenman adı<input name="title" maxlength="80" required value="${esc(item.title)}" placeholder="Örn. Üst vücut"></label>
      <div class="form-row"><label class="field">Her hafta<select name="weekday">${['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'].map((day, index) => `<option value="${index}" ${Number(item.weekday) === index ? 'selected' : ''}>${day}</option>`).join('')}</select></label><label class="field">Saat<input name="time" type="time" value="${item.time || ''}"></label></div>
      <label class="field">Süre (dakika)<input name="duration" type="number" min="5" max="300" required value="${item.duration}"></label>
      <label class="field">Hareketler <span class="small">Her satıra bir hareket; set ve tekrarı yanına yaz.</span><textarea name="exercises" maxlength="800" placeholder="Bench press — 4×8&#10;Row — 4×10&#10;Lateral raise — 3×12">${esc(item.exercises || '')}</textarea></label>
      <p class="sheet-copy">Program önümüzdeki dört haftanın takvimine otomatik eklenir. Her haftanın hareketlerini ayrı ayrı işaretleyebilirsin.</p>${formActions(Boolean(existing))}</form>`, root => {
      $('#workout-template-form', root).addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const next = { id: existing?.id || id(), title: data.get('title').trim(), weekday: Number(data.get('weekday')), time: data.get('time'), duration: Number(data.get('duration')), exercises: data.get('exercises').split(/\r?\n/).map(x => x.trim()).filter(Boolean).join('\n'), skippedDates: existing?.skippedDates || [] };
        if (existing) {
          Object.assign(existing, next);
          state.workouts = state.workouts.filter(workout => workout.templateId !== existing.id || workout.done || workout.date < todayISO());
        } else state.workoutTemplates.push(next);
        syncWorkoutTemplates(); save(); closeSheet(); render(); showToast('Haftalık program kaydedildi');
      });
      $('[data-delete-item]', root)?.addEventListener('click', () => {
        state.workoutTemplates = state.workoutTemplates.filter(template => template.id !== existing.id);
        state.workouts = state.workouts.filter(workout => workout.templateId !== existing.id || workout.done || workout.date < todayISO());
        save(); closeSheet(); render(); showToast('Haftalık program silindi');
      });
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
    const item = existing || { title: '', amount: '', type: 'fixed', category: 'Abonelik', dueDay: 1, paidMonths: [], includedInStatement: true };
    const categories = ['Fatura', 'Abonelik', 'Aidat', 'Kredi', 'Sigorta', 'Diğer'];
    openSheet('Bütçe', existing ? 'Düzenli gideri düzenle' : 'Düzenli gider ekle', `<form class="form" id="recurring-expense-form">
      <label class="field">Gider adı<input name="title" maxlength="80" required value="${esc(item.title)}" placeholder="İnternet, Netflix, elektrik..."></label>
      <label class="field">Bu ayki tutar (TL)<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${item.amount}" placeholder="0"></label>
      <div class="form-row"><label class="field">Tür<select name="type"><option value="fixed" ${item.type === 'fixed' || item.type === 'statement' ? 'selected' : ''}>Sabit gider</option><option value="bill" ${item.type === 'bill' ? 'selected' : ''}>Fatura / abonelik</option></select></label><label class="field">Kategori<select name="category">${categories.map(x => `<option ${x === item.category ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <label class="field">Son ödeme günü<input name="dueDay" type="number" min="1" max="31" required value="${item.dueDay}"></label>
      <label class="checkbox-field"><input name="includedInStatement" type="checkbox" ${item.includedInStatement ? 'checked' : ''}> Bu ödeme kredi kartı ekstresinin içinde</label>
      <p class="sheet-copy">İşaretlersen ödeme takip edilir fakat toplam ekstrede zaten bulunduğu için bütçeden ikinci kez düşülmez.</p>${formActions(Boolean(existing))}</form>`, root => {
      $('#recurring-expense-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = { id: existing?.id || id(), title: data.get('title').trim(), amount: Number(data.get('amount')), type: data.get('type'), category: data.get('category'), dueDay: Number(data.get('dueDay')), includedInStatement: data.get('includedInStatement') === 'on', paidMonths: existing?.paidMonths || [] }; if (existing) { Object.assign(existing, next); const payment = state.expenses.find(x => x.recurringExpenseId === existing.id && x.recurringMonth === currentMonthKey()); if (payment) { payment.amount = next.amount; payment.category = next.category; payment.note = next.title; } } else state.recurringExpenses.push(next); save(); closeSheet(); render(); showToast('Düzenli gider kaydedildi'); });
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
    const item = existing || { date: todayISO(), duration: 450, energy: 3, quality: 3 };
    const hours = Math.floor(Number(item.duration || 0) / 60);
    const minutes = Math.round(Number(item.duration || 0) % 60);
    openSheet('Uyku', existing ? 'Uyku kaydını düzenle' : 'Uyku kaydet', `<form class="form" id="item-form">
      <label class="field">Tarih<input name="date" type="date" required value="${item.date}"></label>
      <div class="form-row"><label class="field">Uyku süresi — saat<input name="hours" type="number" min="0" max="24" step="1" inputmode="numeric" required value="${hours}"></label><label class="field">Dakika<input name="minutes" type="number" min="0" max="59" step="5" inputmode="numeric" required value="${minutes}"></label></div>
      <div class="form-row"><label class="field">Sabah enerjisi<select name="energy">${[1,2,3,4,5].map(x => `<option value="${x}" ${Number(item.energy) === x ? 'selected' : ''}>${x} / 5</option>`).join('')}</select></label><label class="field">Uyku kalitesi<select name="quality">${[1,2,3,4,5].map(x => `<option value="${x}" ${Number(item.quality) === x ? 'selected' : ''}>${x} / 5</option>`).join('')}</select></label></div>${formActions(Boolean(existing))}</form>`, root => {
      $('#item-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const duration = Number(data.get('hours')) * 60 + Number(data.get('minutes')); if (duration <= 0 || duration > 1440) return showToast('Uyku süresi 1 dakika ile 24 saat arasında olmalı'); const next = { id: existing?.id || id(), date: data.get('date'), energy: Number(data.get('energy')), quality: Number(data.get('quality')), duration }; if (existing) Object.assign(existing, next); else { state.sleepEntries = state.sleepEntries.filter(x => x.date !== next.date); state.sleepEntries.push(next); } save(); closeSheet(); render(); showToast('Uyku kaydedildi'); });
      $('[data-delete-item]', root)?.addEventListener('click', () => { state.sleepEntries = state.sleepEntries.filter(x => x.id !== existing.id); save(); closeSheet(); render(); showToast('Uyku kaydı silindi'); });
    });
  }

  function openBudgetSettings() {
    const monthKey = currentMonthKey();
    openSheet('Bütçe', 'Bu ayın finans bilgileri', `<form class="form" id="budget-settings-form"><label class="field">Bankadaki birikim (TL)<input name="bankSavings" type="number" step="100" required value="${state.settings.bankSavings || 0}"></label><div class="form-row"><label class="field">Aylık maaş (TL)<input name="monthlySalary" type="number" min="0" step="100" required value="${state.settings.monthlySalary || 0}"></label><label class="field">Bu ayın toplam ekstresi (TL)<input name="statement" type="number" min="0" step="0.01" required value="${state.settings.monthlyStatements?.[monthKey] || 0}"></label></div><label class="field">Birikim hedefi (TL)<input name="savingsTarget" type="number" min="0" step="100" required value="${state.settings.savingsTarget}"></label><p class="sheet-copy">Maaş, düzenli giderler ve ekstre ayrı tutulur. Ay sonunda kalacak tutar bu üç kalemden hesaplanır; banka birikimin manuel bir bakiyedir.</p><button class="button primary block" type="submit">Finansı güncelle</button></form>`, root => {
      $('#budget-settings-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); state.settings.bankSavings = Number(data.get('bankSavings')); state.settings.monthlySalary = Number(data.get('monthlySalary')); state.settings.monthlyStatements = { ...(state.settings.monthlyStatements || {}), [monthKey]: Number(data.get('statement')) }; state.settings.savingsTarget = Number(data.get('savingsTarget')); save(); closeSheet(); render(); showToast('Bu ayın finans bilgileri güncellendi'); });
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
    openSheet('Bütçe değerlendirmesi', e.title, `<p class="sheet-copy">${esc(e.detail)}</p><div class="evaluation-box"><strong>Öneri:</strong><br>${esc(e.suggestion)}</div><div class="action-grid"><button class="button primary" type="button" data-update-finance>Finansı güncelle</button><button class="button" type="button" data-add-recurring>Düzenli gider ekle</button></div>`, root => { $('[data-update-finance]', root).addEventListener('click', openBudgetSettings); $('[data-add-recurring]', root).addEventListener('click', () => openRecurringExpenseForm()); });
  }

  function openSettings() {
    openSheet('Kişisel Merkez', 'Ayarlar ve yedek', `<div class="settings-list">
      <form class="settings-block form" id="profile-form"><label class="field">Adın<input name="name" maxlength="40" required value="${esc(state.profile.name)}"></label><label class="field">Görünüm<select name="theme"><option value="auto" ${state.settings.theme === 'auto' ? 'selected' : ''}>Telefon ayarını kullan</option><option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Açık</option><option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Koyu</option></select></label><button class="button primary" type="submit">Ayarları kaydet</button></form>
      <div class="settings-block"><h3>Hatırlatmalar</h3><p>Görev ve spor saatlerinde bu cihazda bildirim gösterebilir. İlk sürümde kontrol uygulama açıkken yapılır.</p><button class="button" type="button" data-enable-notifications>${state.settings.notifications ? 'Bildirimler açık' : 'Bildirimleri aç'}</button></div>
      <div class="settings-block"><h3>Uygulama kilidi</h3><p>Bütçe ve planlarını meraklı gözlerden korumak için 4–6 haneli bir PIN kullan.</p><div class="settings-actions"><button class="button" type="button" data-pin-settings>${state.settings.pinHash ? 'PIN’i değiştir' : 'PIN belirle'}</button>${state.settings.pinHash ? '<button class="button" type="button" data-lock-now>Şimdi kilitle</button>' : ''}</div></div>
      <div class="settings-block"><h3>Yedekleme</h3><p>Kayıtların bu cihazda saklanır. ${state.settings.lastBackupAt ? `Son yedek: ${shortDate(state.settings.lastBackupAt.slice(0,10))}.` : 'Henüz yedek alınmadı.'}</p><div class="settings-actions"><button class="button" type="button" data-export>Yedeği indir</button><button class="button" type="button" data-import>Yedekten yükle</button></div></div>
      <div class="settings-block"><h3>iPhone’a kur</h3><p>Siteyi Safari’de aç. Paylaş simgesine dokunup “Ana Ekrana Ekle”yi seç.</p></div>
    </div>`, root => {
      $('#profile-form', root).addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); state.profile.name = data.get('name').trim(); state.settings.theme = data.get('theme'); save(); applyTheme(); closeSheet(); render(); showToast('Ayarlar kaydedildi'); });
      $('[data-enable-notifications]', root).addEventListener('click', enableNotifications);
      $('[data-pin-settings]', root).addEventListener('click', openPinSettings);
      $('[data-lock-now]', root)?.addEventListener('click', () => { closeSheet(); showPinLock(); });
      $('[data-export]', root).addEventListener('click', exportBackup);
      $('[data-import]', root).addEventListener('click', () => $('#backup-file').click());
    });
  }

  async function hashPin(pin) {
    const bytes = new TextEncoder().encode(`kisisel-merkez:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function openPinSettings() {
    openSheet('Gizlilik', state.settings.pinHash ? 'PIN’i değiştir' : 'PIN belirle', `<form class="form" id="pin-form"><label class="field">Yeni PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" required autocomplete="new-password" placeholder="4–6 rakam"></label><label class="field">PIN tekrar<input name="confirm" type="password" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" required autocomplete="new-password"></label><p class="sheet-copy">Bu kilit cihazdaki günlük kullanım gizliliği içindir. PIN’i unutursan tarayıcı verilerini temizlemek uygulama kayıtlarını da siler.</p><div class="form-actions">${state.settings.pinHash ? '<button class="button danger" type="button" data-remove-pin>PIN’i kaldır</button>' : ''}<button class="button primary" type="submit">Kaydet</button></div></form>`, root => {
      $('#pin-form', root).addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); const pin = data.get('pin'); if (pin !== data.get('confirm')) return showToast('PIN’ler aynı değil'); state.settings.pinHash = await hashPin(pin); save(); closeSheet(); showToast('PIN kilidi açıldı'); });
      $('[data-remove-pin]', root)?.addEventListener('click', () => { state.settings.pinHash = ''; save(); closeSheet(); showToast('PIN kilidi kaldırıldı'); });
    });
  }

  function showPinLock() {
    if (!state.settings.pinHash || $('#pin-lock')) return;
    const lock = document.createElement('div');
    lock.id = 'pin-lock';
    lock.className = 'pin-lock';
    lock.innerHTML = `<form class="pin-card"><div class="lock-icon">◈</div><h2>Kısa bir kontrol</h2><p>Kişisel Merkez PIN’ini gir.</p><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required autocomplete="current-password" aria-label="PIN" autofocus><button class="button primary block" type="submit">Kilidi aç</button><span class="pin-error" role="status"></span></form>`;
    document.body.appendChild(lock);
    $('form', lock).addEventListener('submit', async event => { event.preventDefault(); const pin = new FormData(event.currentTarget).get('pin'); if (await hashPin(pin) === state.settings.pinHash) lock.remove(); else { $('.pin-error', lock).textContent = 'PIN yanlış'; $('input', lock).value = ''; $('input', lock).focus(); } });
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
    state.settings.lastBackupAt = new Date().toISOString();
    save();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kisisel-merkez-yedek-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    render();
    showToast('Yedek indirildi');
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported || imported.version !== 1 || !Array.isArray(imported.tasks)) throw new Error('Geçersiz yedek');
        state = normalizeState(imported); save(); applyTheme(); closeSheet(); syncRecurringTasks(); render(); if (state.settings.pinHash) showPinLock(); showToast('Yedek yüklendi');
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
        const monthKey = currentMonthKey();
        const salary = Number(state.settings.monthlySalary || 0);
        const recurringExpenses = state.recurringExpenses.filter(item => item.type !== 'statement' && !item.includedInStatement).reduce((sum, item) => sum + Number(item.amount), 0);
        const statement = Number(state.settings.monthlyStatements?.[monthKey] || 0);
        return {
          date: todayISO(),
          tasks: { total: items.tasks.length, completed: items.tasks.filter(x => x.done).length, priorities: items.tasks.filter(x => x.priority).map(x => x.title) },
          workouts: items.workouts.map(x => { const exercises = workoutExercises(x); return { id: x.id, title: x.title, time: x.time, completed: x.done, completedExercises: exercises.filter(item => item.done).length, totalExercises: exercises.length, exercises: exercises.map(item => ({ id: item.id, name: item.name, done: item.done })) }; }),
          weeklyWorkoutProgram: state.workoutTemplates.map(template => ({ id: template.id, title: template.title, weekday: Number(template.weekday), time: template.time, duration: Number(template.duration) })),
          todaySpending: items.expenses.reduce((sum, x) => sum + Number(x.amount), 0),
          todayIncome: state.incomes.filter(x => x.date === todayISO()).reduce((sum, x) => sum + Number(x.amount), 0),
          latestSleep: items.sleep ? { date: items.sleep.date, durationMinutes: items.sleep.duration, energy: items.sleep.energy, quality: items.sleep.quality } : null,
          budget: { month: monthKey, bankSavings: Number(state.settings.bankSavings || 0), monthlySalary: salary, recurringExpenses, statement, monthRemainder: salary - recurringExpenses - statement },
          upcomingPayments: upcomingPayments().map(({ item, due }) => ({ title: item.title, amount: Number(item.amount), dueDate: toISO(due) })),
          inboxNotes: state.inboxNotes.map(note => note.text),
          goals: state.goals.map(goal => ({ id: goal.id, title: goal.title, current: goal.current, target: goal.target, unit: goal.unit }))
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
      name: 'capture_note',
      title: 'Hızlı not ekle',
      description: 'Kişisel Merkez hızlı not kutusuna daha sonra işlenecek bir not ekler.',
      inputSchema: { type: 'object', properties: { text: { type: 'string', minLength: 1, maxLength: 300 } }, required: ['text'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const note = { id: id(), text: requireText(input?.text, 'Not').slice(0, 300), createdAt: new Date().toISOString() };
        state.inboxNotes.push(note); save(); render();
        return { id: note.id, status: 'created', text: note.text };
      }
    });

    register({
      name: 'set_goal_progress',
      title: 'Hedef ilerlemesini güncelle',
      description: 'Mevcut bir hedefin güncel değerini değiştirir.',
      inputSchema: { type: 'object', properties: { goalId: { type: 'string' }, current: { type: 'number', minimum: 0 } }, required: ['goalId', 'current'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const goal = state.goals.find(item => item.id === input?.goalId);
        if (!goal) throw new Error('Hedef bulunamadı');
        const current = Number(input.current); if (!Number.isFinite(current) || current < 0) throw new Error('Mevcut değer geçersiz');
        goal.current = current; save(); render();
        return { id: goal.id, status: 'updated', current: goal.current, target: goal.target };
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
      name: 'create_weekly_workout',
      title: 'Haftalık spor programı oluştur',
      description: 'Her hafta aynı gün tekrarlanan bir antrenman programı oluşturur ve önümüzdeki dört haftanın takvimine ekler.',
      inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1, maxLength: 80 }, weekday: { type: 'number', minimum: 0, maximum: 6, description: 'Pazar 0, pazartesi 1, ... cumartesi 6' }, time: { type: 'string', description: 'SS:DD' }, duration: { type: 'number', minimum: 5, maximum: 300 }, exercises: { type: 'string', maxLength: 800, description: 'Her satırda bir hareket' } }, required: ['title', 'weekday', 'duration'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const weekday = Number(input?.weekday); const duration = Number(input?.duration);
        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Haftanın günü 0 ile 6 arasında olmalı');
        if (!Number.isFinite(duration) || duration < 5 || duration > 300) throw new Error('Süre 5 ile 300 dakika arasında olmalı');
        const template = { id: id(), title: requireText(input?.title, 'Antrenman adı').slice(0, 80), weekday, time: optionalTime(input?.time), duration, exercises: typeof input?.exercises === 'string' ? input.exercises.trim().slice(0, 800) : '', skippedDates: [] };
        state.workoutTemplates.push(template); syncWorkoutTemplates(); save(); render();
        return { id: template.id, status: 'created', title: template.title, weekday: template.weekday, generatedWeeks: 4 };
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
      name: 'update_monthly_finance',
      title: 'Aylık finansı güncelle',
      description: 'Bankadaki birikimi, aylık maaşı, bu ayın toplam ekstresini ve isteğe bağlı birikim hedefini günceller.',
      inputSchema: { type: 'object', properties: { bankSavings: { type: 'number' }, monthlySalary: { type: 'number', minimum: 0 }, statement: { type: 'number', minimum: 0 }, savingsTarget: { type: 'number', minimum: 0 } }, required: ['bankSavings', 'monthlySalary', 'statement'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const bankSavings = Number(input?.bankSavings); const monthlySalary = Number(input?.monthlySalary); const statement = Number(input?.statement);
        if (![bankSavings, monthlySalary, statement].every(Number.isFinite) || monthlySalary < 0 || statement < 0) throw new Error('Finans tutarları geçersiz');
        state.settings.bankSavings = bankSavings;
        state.settings.monthlySalary = monthlySalary;
        state.settings.monthlyStatements = { ...(state.settings.monthlyStatements || {}), [currentMonthKey()]: statement };
        if (input?.savingsTarget != null) { const target = Number(input.savingsTarget); if (!Number.isFinite(target) || target < 0) throw new Error('Birikim hedefi geçersiz'); state.settings.savingsTarget = target; }
        save(); render();
        const recurringExpenses = state.recurringExpenses.filter(item => item.type !== 'statement' && !item.includedInStatement).reduce((sum, item) => sum + Number(item.amount), 0);
        return { status: 'updated', bankSavings, monthlySalary, recurringExpenses, statement, monthRemainder: monthlySalary - recurringExpenses - statement };
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
      description: 'Toplam süre, enerji ve kalite bilgileriyle bir uyku kaydı oluşturur.',
      inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'Uyku kaydının günü, YYYY-AA-GG' }, durationMinutes: { type: 'number', minimum: 1, maximum: 1440 }, energy: { type: 'number', minimum: 1, maximum: 5 }, quality: { type: 'number', minimum: 1, maximum: 5 } }, required: ['date', 'durationMinutes', 'energy', 'quality'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const duration = Number(input?.durationMinutes);
        if (!Number.isFinite(duration) || duration < 1 || duration > 1440) throw new Error('Uyku süresi 1 ile 1440 dakika arasında olmalı');
        const energy = Number(input?.energy); const quality = Number(input?.quality);
        if (![energy, quality].every(x => Number.isFinite(x) && x >= 1 && x <= 5)) throw new Error('Enerji ve kalite 1 ile 5 arasında olmalı');
        const sleep = { id: id(), date: requireDate(input?.date), energy, quality, duration };
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
      if (button.dataset.add === 'workout-template') openWorkoutTemplateForm();
      if (button.dataset.add === 'expense') openExpenseForm(null, date);
      if (button.dataset.add === 'income') openIncomeForm(null, date);
      if (button.dataset.add === 'recurring-expense') openRecurringExpenseForm();
      if (button.dataset.add === 'recurring-task') openRecurringTaskForm();
      if (button.dataset.add === 'inbox') openInboxForm();
      if (button.dataset.add === 'goal') openGoalForm();
      if (button.dataset.add === 'sleep') openSleepForm();
    }
    if (button.dataset.toggleTask) { const item = state.tasks.find(x => x.id === button.dataset.toggleTask); if (item) { item.done = !item.done; save(); render(); showToast(item.done ? 'Görev tamamlandı' : 'Görev yeniden açıldı'); } }
    if (button.dataset.toggleWorkout) { const item = state.workouts.find(x => x.id === button.dataset.toggleWorkout); if (item) { item.done = !item.done; save(); render(); showToast(item.done ? 'Antrenman tamamlandı' : 'Antrenman yeniden açıldı'); } }
    if (button.dataset.workoutDetail) { const item = state.workouts.find(x => x.id === button.dataset.workoutDetail); if (item) openWorkoutDetail(item); }
    if (button.dataset.editTask) openTaskForm(state.tasks.find(x => x.id === button.dataset.editTask));
    if (button.dataset.editWorkout) openWorkoutForm(state.workouts.find(x => x.id === button.dataset.editWorkout));
    if (button.dataset.editWorkoutTemplate) openWorkoutTemplateForm(state.workoutTemplates.find(x => x.id === button.dataset.editWorkoutTemplate));
    if (button.dataset.editExpense) openExpenseForm(state.expenses.find(x => x.id === button.dataset.editExpense));
    if (button.dataset.editIncome) openIncomeForm(state.incomes.find(x => x.id === button.dataset.editIncome));
    if (button.dataset.editRecurringExpense) openRecurringExpenseForm(state.recurringExpenses.find(x => x.id === button.dataset.editRecurringExpense));
    if (button.dataset.toggleRecurringPaid) { const item = state.recurringExpenses.find(x => x.id === button.dataset.toggleRecurringPaid); if (item) toggleRecurringPaid(item); }
    if (button.dataset.editRecurringTask) openRecurringTaskForm(state.recurringTasks.find(x => x.id === button.dataset.editRecurringTask));
    if (button.dataset.editGoal) openGoalForm(state.goals.find(x => x.id === button.dataset.editGoal));
    if (button.dataset.inboxToTask) { const note = state.inboxNotes.find(x => x.id === button.dataset.inboxToTask); if (note) openTaskForm(null, todayISO(), note.text, note.id); }
    if (button.dataset.deleteInbox) { state.inboxNotes = state.inboxNotes.filter(x => x.id !== button.dataset.deleteInbox); save(); render(); showToast('Not silindi'); }
    if (button.dataset.editSleep) openSleepForm(state.sleepEntries.find(x => x.id === button.dataset.editSleep));
    if (button.dataset.month) { calendarCursor.setMonth(calendarCursor.getMonth() + Number(button.dataset.month)); selectedCalendarDate = toISO(calendarCursor); renderCalendar(); }
    if (button.dataset.calendarDate) { selectedCalendarDate = button.dataset.calendarDate; renderCalendar(); }
    if (button.dataset.planTab) { planTab = button.dataset.planTab; renderPlans(); }
    if (button.hasAttribute('data-settings-budget')) openBudgetSettings();
    if (button.hasAttribute('data-open-evaluation')) openEvaluation();
    if (button.hasAttribute('data-open-week-review')) openWeekReview();
    if (button.hasAttribute('data-open-budget-evaluation')) openBudgetEvaluation();
    if (button.hasAttribute('data-open-week-planner')) openWeekPlanner();
    if (button.hasAttribute('data-open-budget')) { planTab = 'budget'; setRoute('plans'); }
    if (button.hasAttribute('data-export')) exportBackup();
  });

  $$('[data-route]').forEach(button => button.addEventListener('click', () => setRoute(button.dataset.route)));
  $('#settings-button').addEventListener('click', openSettings);
  $('#sheet-close').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', event => { if (event.target === sheetBackdrop) closeSheet(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sheetBackdrop.hidden) closeSheet(); });

  fab.addEventListener('click', () => { quickMenu.hidden = !quickMenu.hidden; fab.setAttribute('aria-expanded', String(!quickMenu.hidden)); });
  $$('[data-quick]').forEach(button => button.addEventListener('click', () => { quickMenu.hidden = true; fab.setAttribute('aria-expanded', 'false'); const type = button.dataset.quick; if (type === 'task') openTaskForm(); if (type === 'workout') openWorkoutForm(); if (type === 'expense') openExpenseForm(); if (type === 'income') openIncomeForm(); if (type === 'sleep') openSleepForm(); if (type === 'inbox') openInboxForm(); }));
  document.addEventListener('click', event => { if (!quickMenu.hidden && !quickMenu.contains(event.target) && !fab.contains(event.target)) { quickMenu.hidden = true; fab.setAttribute('aria-expanded', 'false'); } });

  $('#backup-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) importBackup(file); event.target.value = ''; });

  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker kaydedilemedi', error)));
  applyTheme();
  render();
  showPinLock();
  registerWebMCP();
  checkReminders();
  setInterval(checkReminders, 30000);
})();

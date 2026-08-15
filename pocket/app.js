import PocketBase from "pocketbase";

const today = new Date();
const isoToday = toDateInput(today);

const AUTO_COMPLETE_INTERVAL_MS = 1000;
const LIVE_REMINDER_INTERVAL_MS = 1000;
const REMINDER_CHECK_INTERVAL_MS = 60 * 1000;
const REMINDER_WINDOW_MS = 30 * 60 * 1000;
const ADMIN_LOGIN_LOCK_KEY = "gap-navbati-admin-login-lock";
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_LOCK_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_DOMAIN = "gapnavbati.local";
const DEFAULT_MAP_POSITION = {
  lat: 40.4367931,
  lng: 70.6134872,
  zoom: 15,
};
// `window.POCKETBASE_URL` can be set in config.js for a remote deployment.
// Locally, the PocketBase API runs on its standard port; when this file is
// served by PocketBase itself, the API shares the current origin.
const pocketBaseUrl =
  window.POCKETBASE_URL ||
  (location.port === "8090"
    ? location.origin
    : `${location.protocol}//${location.hostname || "127.0.0.1"}:8090`);
const pb = new PocketBase(pocketBaseUrl);

let queues = [];
let queueFilter = "all";
let queueQuery = "";
let historyQuery = "";
let statusFilter = "all";
let adminLogs = [];
const shownReminders = new Set();

const els = {
  loader: document.querySelector("#loader"),
  roleSwitch: document.querySelector("#roleSwitch"),
  adminPanelButton: document.querySelector("#adminPanelButton"),
  adminLoginModal: document.querySelector("#adminLoginModal"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminLogin: document.querySelector("#adminLogin"),
  adminPassword: document.querySelector("#adminPassword"),
  adminLoginCancel: document.querySelector("#adminLoginCancel"),
  queueReminderBar: document.querySelector("#queueReminderBar"),
  queueReminderText: document.querySelector("#queueReminderText"),
  queueReminderTime: document.querySelector("#queueReminderTime"),
  themeToggle: document.querySelector("#themeToggle"),
  menuToggle: document.querySelector("#menuToggle"),
  navLinks: document.querySelector("#navLinks"),
  form: document.querySelector("#queueForm"),
  queueId: document.querySelector("#queueId"),
  firstName: document.querySelector("#firstName"),
  lastName: document.querySelector("#lastName"),
  phone: document.querySelector("#phone"),
  secretCode: document.querySelector("#secretCode"),
  mapLocation: document.querySelector("#mapLocation"),
  mapLocationText: document.querySelector("#mapLocationText"),
  date: document.querySelector("#date"),
  time: document.querySelector("#time"),
  note: document.querySelector("#note"),
  latestGrid: document.querySelector("#latestGrid"),
  queueGrid: document.querySelector("#queueGrid"),
  historyBody: document.querySelector("#historyBody"),
  adminGrid: document.querySelector("#adminGrid"),
  adminHistoryBody: document.querySelector("#adminHistoryBody"),
  adminAuditBody: document.querySelector("#adminAuditBody"),
  queueSearch: document.querySelector("#queueSearch"),
  historySearch: document.querySelector("#historySearch"),
  adminSearch: document.querySelector("#adminSearch"),
  statusFilter: document.querySelector("#statusFilter"),
  heroTotalCount: document.querySelector("#heroTotalCount"),
  heroActiveCount: document.querySelector("#heroActiveCount"),
  heroDoneCount: document.querySelector("#heroDoneCount"),
  heroCancelledCount: document.querySelector("#heroCancelledCount"),
  toastStack: document.querySelector("#toastStack"),
  detailModal: document.querySelector("#detailModal"),
  detailTitle: document.querySelector("#detailTitle"),
  detailList: document.querySelector("#detailList"),
  mapPickerModal: document.querySelector("#mapPickerModal"),
  mapPickerCanvas: document.querySelector("#mapPickerCanvas"),
  mapPickerSearchForm: document.querySelector("#mapPickerSearchForm"),
  mapPickerSearch: document.querySelector("#mapPickerSearch"),
  mapPickerSave: document.querySelector("#mapPickerSave"),
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  doneCount: document.querySelector("#doneCount"),
  cancelledCount: document.querySelector("#cancelledCount"),
  weeklyCount: document.querySelector("#weeklyCount"),
  monthlyCount: document.querySelector("#monthlyCount"),
  weeklyChart: document.querySelector("#weeklyChart"),
  monthlyChart: document.querySelector("#monthlyChart"),
  monthlyChartLegend: document.querySelector("#monthlyChartLegend"),
  adminEditForm: document.querySelector("#adminEditForm"),
  adminQueueId: document.querySelector("#adminQueueId"),
  adminFirstName: document.querySelector("#adminFirstName"),
  adminLastName: document.querySelector("#adminLastName"),
  adminPhone: document.querySelector("#adminPhone"),
  adminSecretCode: document.querySelector("#adminSecretCode"),
  adminMapLocation: document.querySelector("#adminMapLocation"),
  adminMapLocationText: document.querySelector("#adminMapLocationText"),
  adminDate: document.querySelector("#adminDate"),
  adminTime: document.querySelector("#adminTime"),
  adminNote: document.querySelector("#adminNote"),
  adminCancelEdit: document.querySelector("#adminCancelEdit"),
};

let mapPickerField = null;
let mapPickerDisplay = null;
let mapPickerMap = null;
let mapPickerMarker = null;
let mapPickerPosition = null;

document.addEventListener("DOMContentLoaded", async () => {
  setInitialTheme();
  els.date.min = isoToday;
  bindEvents();
  await restoreAdminSession();
  await refreshQueues();
  revealOnScroll();
  updateActiveMenu();
  window.setTimeout(() => els.loader.classList.add("hidden"), 550);
  window.setInterval(syncExpiredQueues, AUTO_COMPLETE_INTERVAL_MS);
  window.setInterval(renderPersistentReminder, LIVE_REMINDER_INTERVAL_MS);
  window.setInterval(checkQueueReminders, REMINDER_CHECK_INTERVAL_MS);
  renderPersistentReminder();
  checkQueueReminders();
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      await refreshQueues();
      checkQueueReminders();
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

function bindEvents() {
  els.adminPanelButton.addEventListener("click", showAdminLogin);
  els.adminLoginForm.addEventListener("submit", handleAdminLogin);
  els.adminLoginCancel.addEventListener("click", hideAdminLogin);
  els.roleSwitch.addEventListener("click", resetRole);
  els.themeToggle.addEventListener("click", toggleTheme);
  els.menuToggle.addEventListener("click", () =>
    els.navLinks.classList.toggle("open"),
  );

  document
    .querySelectorAll(".nav-links a, .nav-actions a, .footer-links a")
    .forEach((link) => {
      link.addEventListener("click", () => {
        els.navLinks.classList.remove("open");
        updateActiveMenu(link.getAttribute("href"));
      });
    });

  window.addEventListener("hashchange", () => updateActiveMenu());
  window.addEventListener("scroll", updateActiveMenu, { passive: true });
  window.addEventListener("resize", () => {
    if (document.body.classList.contains("admin-mode")) {
      renderAdminAnalytics();
    }
  });

  els.form.addEventListener("submit", handleSubmit);
  els.adminEditForm.addEventListener("submit", handleAdminEditSubmit);
  els.adminCancelEdit.addEventListener("click", closeAdminEdit);
  els.mapLocationText.addEventListener("input", () => {
    els.mapLocation.value = "";
  });
  els.adminMapLocationText.addEventListener("input", () => {
    els.adminMapLocation.value = "";
  });
  els.detailModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-detail]")) {
      closeDetail();
    }
  });
  els.adminLoginModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-admin-login]")) {
      hideAdminLogin();
    }
  });
  els.mapPickerModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-map-picker]")) {
      closeMapPicker();
    }
  });
  els.mapPickerSearchForm.addEventListener("submit", searchMapLocation);
  els.mapPickerSave.addEventListener("click", saveMapPicker);
  document.querySelectorAll("[data-map-open]").forEach((button) => {
    button.addEventListener("click", () =>
      openMapPicker(button.dataset.mapTarget),
    );
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetail();
      hideAdminLogin();
      closeMapPicker();
    }
  });
  els.latestGrid.addEventListener("click", handleCardAction);
  els.queueGrid.addEventListener("click", handleCardAction);
  els.adminGrid.addEventListener("click", handleCardAction);
  els.adminHistoryBody.addEventListener("click", handleCardAction);
  els.queueSearch.addEventListener("input", (event) => {
    queueQuery = event.target.value.trim().toLowerCase();
    renderQueues();
  });
  els.secretCode.addEventListener("input", () => {
    els.secretCode.value = els.secretCode.value.replace(/\D/g, "").slice(0, 4);
  });

  els.adminSecretCode.addEventListener("input", () => {
    els.adminSecretCode.value = els.adminSecretCode.value
      .replace(/\D/g, "")
      .slice(0, 4);
  });

  els.historySearch.addEventListener("input", (event) => {
    historyQuery = event.target.value.trim().toLowerCase();
    renderHistory();
  });

  els.adminSearch.addEventListener("input", (event) => {
    historyQuery = event.target.value.trim().toLowerCase();
    renderAdmin();
  });

  els.statusFilter.addEventListener("change", (event) => {
    statusFilter = event.target.value;
    renderHistory();
  });

  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-button")
        .forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      queueFilter = button.dataset.filter;
      renderQueues();
    });
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const item = {
    firstName: els.firstName.value.trim(),
    lastName: els.lastName.value.trim(),
    phone: els.phone.value.trim(),
    secretCode: els.secretCode.value.trim(),
    location: els.mapLocationText.value.trim(),
    mapLocation: els.mapLocation.value.trim(),
    date: els.date.value,
    time: els.time.value,
    note: els.note.value.trim(),
    status: "active",
  };
  const id = els.queueId.value;

  if (
    !item.firstName ||
    !item.lastName ||
    !item.phone ||
    !item.secretCode ||
    !item.location ||
    !item.date ||
    !item.time
  ) {
    showToast("Kerakli maydonlarni to'ldiring.", "error");
    return;
  }

  if (!/^\d{4}$/.test(item.secretCode)) {
    showToast(
      "4 xonali kod faqat 4 ta raqamdan iborat bo'lishi kerak.",
      "error",
    );
    return;
  }

  if (isSecretCodeTaken(item.secretCode, id)) {
    showToast("Bu son kiritilgan. Boshqa son kiriting.", "error");
    return;
  }

  try {
    if (id) {
      const current = queues.find((queue) => queue.id === id);
      const updated = await updateQueue(id, { ...current, ...item });
      queues = queues.map((queue) => (queue.id === id ? updated : queue));
      showToast("Navbat muvaffaqiyatli yangilandi.", "success");
    } else {
      const created = await createQueue(item);
      queues.unshift(created);
      window.alert(
        `Navbat saqlandi.\n4 xonali son: ${item.secretCode}\nEslab qoling, o'zgartirish yoki o'chirishda kerak bo'ladi.`,
      );
    }

    els.form.reset();
    els.queueId.value = "";
    setMapInputValue(els.mapLocation, els.mapLocationText, "");
    render();
    checkQueueReminders();
    document
      .querySelector("#queues")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

function render() {
  renderLatest();
  renderQueues();
  renderHistory();
  renderAdmin();
  renderAdminAudit();
  renderHeroStats();
  renderPersistentReminder();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderHeroStats() {
  els.heroTotalCount.textContent = queues.length;
  els.heroActiveCount.textContent = queues.filter(
    (item) => item.status === "active",
  ).length;
  els.heroDoneCount.textContent = queues.filter(
    (item) => item.status === "done",
  ).length;
  els.heroCancelledCount.textContent = queues.filter(
    (item) => item.status === "cancelled",
  ).length;
}

function renderAdmin() {
  const filtered = queues.filter((item) =>
    matchesQuery(item, historyQuery, true),
  );
  const activeFiltered = filtered.filter((item) => item.status === "active");

  els.totalCount.textContent = queues.length;
  els.activeCount.textContent = queues.filter(
    (item) => item.status === "active",
  ).length;
  els.doneCount.textContent = queues.filter(
    (item) => item.status === "done",
  ).length;
  els.cancelledCount.textContent = queues.filter(
    (item) => item.status === "cancelled",
  ).length;
  renderAdminAnalytics();

  els.adminGrid.innerHTML = activeFiltered.length
    ? activeFiltered.map((item) => adminCard(item)).join("")
    : emptyState("Faol navbat topilmadi.");

  els.adminHistoryBody.innerHTML = filtered.length
    ? filtered.map(adminHistoryRow).join("")
    : `<tr><td colspan="10" class="empty-row">Tarix bo'yicha ma'lumot topilmadi.</td></tr>`;

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderAdminAnalytics() {
  const weekDays = getLastSevenDays();
  const weekItems = queues.filter((item) =>
    isDateBetween(item.date, weekDays[0], addDays(weekDays[6], 1)),
  );
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthItems = queues.filter((item) =>
    isDateBetween(item.date, monthStart, nextMonth),
  );

  els.weeklyCount.textContent = weekItems.length;
  els.monthlyCount.textContent = monthItems.length;

  const weeklyData = weekDays.map((date) => {
    const value = toDateInput(date);
    return {
      label: `${date.getDate()}.${date.getMonth() + 1}`,
      value: weekItems.filter((item) => item.date === value).length,
    };
  });

  const monthlyData = [
    {
      label: "Faol",
      value: monthItems.filter((item) => item.status === "active").length,
      color: "#22c55e",
    },
    {
      label: "Tugallangan",
      value: monthItems.filter((item) => item.status === "done").length,
      color: "#38bdf8",
    },
    {
      label: "Bekor qilingan",
      value: monthItems.filter((item) => item.status === "cancelled").length,
      color: "#f43f5e",
    },
  ];

  drawBarChart(els.weeklyChart, weeklyData);
  drawDoughnutChart(els.monthlyChart, monthlyData);
  renderChartLegend(monthlyData);
}

function renderLatest() {
  const latest = [...queues]
    .filter((item) => item.status === "active")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  els.latestGrid.innerHTML = latest.length
    ? latest.map((item) => latestCard(item)).join("")
    : emptyState("Hali navbat qo'shilmagan.");
}

function renderQueues() {
  const filtered = queues
    .filter(matchesQueueFilter)
    .filter((item) => matchesQuery(item, queueQuery, true));

  els.queueGrid.innerHTML = filtered.length
    ? filtered.map((item) => queueCard(item)).join("")
    : emptyState("Bu filter bo'yicha navbat topilmadi.");

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderHistory() {
  const filtered = queues
    .filter((item) => statusFilter === "all" || item.status === statusFilter)
    .filter((item) => matchesQuery(item, historyQuery));

  els.historyBody.innerHTML = filtered.length
    ? filtered.map(historyRow).join("")
    : `<tr><td colspan="8" class="empty-row">Tarixlar bo'yicha ma'lumot topilmadi.</td></tr>`;
}

function latestCard(item) {
  return `
    <article class="latest-card reveal visible">
      <h3 class="person-title"><i data-lucide="user"></i> ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</h3>
      <div class="meta-list">
        <span class="meta"><i data-lucide="calendar-days"></i> ${formatDate(item.date)}</span>
        <span class="meta"><i data-lucide="clock-3"></i> ${item.time}</span>
      </div>
      <div class="card-actions">
        <button class="action-button" data-action="detail" data-id="${item.id}" type="button" aria-label="Batafsil"><i data-lucide="eye"></i></button>
      </div>
    </article>
  `;
}

function queueCard(item) {
  const status = statusMeta(item.status);

  return `
    <article class="queue-card reveal visible">
      <h3 class="person-title"><i data-lucide="user"></i> ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</h3>
      <div class="meta-list">
        <span class="meta"><i data-lucide="phone"></i> ${escapeHtml(item.phone)}</span>
        <span class="meta"><i data-lucide="map-pin"></i> ${escapeHtml(item.location)}</span>
        ${mapLocationLink(item)}
        <span class="meta"><i data-lucide="calendar-days"></i> ${formatDate(item.date)}</span>
        <span class="meta"><i data-lucide="clock-3"></i> ${item.time}</span>
        <span class="meta"><span class="status ${item.status}">${status.icon} ${status.label}</span></span>
      </div>
      <p>${escapeHtml(item.note || "Izoh kiritilmagan.")}</p>
      <div class="user-admin-note">
        <i data-lucide="info"></i>
        <span>Agar siz o'z navbatingizni olib tashlamoqchi bo'lsangiz, adminga bog'laning.</span>
        <a href="https://t.me/akramov_lvl" target="_blank" rel="noreferrer">Telegram</a>
      </div>
      <div class="card-actions">
        <button class="action-button" data-action="detail" data-id="${item.id}" type="button" aria-label="Batafsil"><i data-lucide="eye"></i></button>
      </div>
    </article>
  `;
}

function adminCard(item) {
  const status = statusMeta(item.status);

  return `
    <article class="queue-card reveal visible">
      <h3 class="person-title"><i data-lucide="shield-check"></i> ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</h3>
      <div class="meta-list">
        <span class="meta"><i data-lucide="phone"></i> ${escapeHtml(item.phone)}</span>
        <span class="meta"><i data-lucide="key-round"></i> Kod: ${escapeHtml(item.secretCode || "-")}</span>
        <span class="meta"><i data-lucide="map-pin"></i> ${escapeHtml(item.location)}</span>
        ${mapLocationLink(item)}
        <span class="meta"><i data-lucide="calendar-days"></i> ${formatDate(item.date)}</span>
        <span class="meta"><i data-lucide="clock-3"></i> ${item.time}</span>
        <span class="meta"><span class="status ${item.status}">${status.icon} ${status.label}</span></span>
      </div>
      <p>${escapeHtml(item.note || "Izoh kiritilmagan.")}</p>
      <div class="card-actions">
        <button class="action-button" data-action="admin-edit" data-id="${item.id}" type="button" aria-label="Edit"><i data-lucide="pencil"></i></button>
        <button class="action-button danger" data-action="admin-delete" data-id="${item.id}" type="button" aria-label="Delete"><i data-lucide="trash-2"></i></button>
        <button class="action-button" data-action="admin-done" data-id="${item.id}" type="button" aria-label="Tugallash"><i data-lucide="check"></i></button>
      </div>
    </article>
  `;
}

function historyRow(item) {
  const status = statusMeta(item.status);

  return `
    <tr>
      <td>${escapeHtml(item.firstName)}</td>
      <td>${escapeHtml(item.lastName)}</td>
      <td>${escapeHtml(item.phone)}</td>
      <td>${locationTableCell(item)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${item.time}</td>
      <td><span class="status ${item.status}">${status.icon} ${status.label}</span></td>
      <td>${escapeHtml(item.cancelReason || "-")}</td>
    </tr>
  `;
}

function adminHistoryRow(item) {
  const status = statusMeta(item.status);

  return `
    <tr>
      <td>${escapeHtml(item.firstName)}</td>
      <td>${escapeHtml(item.lastName)}</td>
      <td>${escapeHtml(item.phone)}</td>
      <td>${escapeHtml(item.secretCode || "-")}</td>
      <td>${locationTableCell(item)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${item.time}</td>
      <td><span class="status ${item.status}">${status.icon} ${status.label}</span></td>
      <td>${escapeHtml(item.cancelReason || "-")}</td>
      <td>
        <button class="action-button danger" data-action="admin-delete-history" data-id="${item.id}" type="button" aria-label="Tarixdan o'chirish">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `;
}

function handleCardAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action.startsWith("admin") && !isAdminAuthenticated()) {
    requireAdminLogin();
    return;
  }

  const item = queues.find((queue) => queue.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "edit") editItem(item);
  if (button.dataset.action === "admin-edit") editAdminItem(item);
  if (button.dataset.action === "admin-delete") deleteItem(item.id);
  if (button.dataset.action === "admin-delete-history") deleteHistoryItem(item.id);
  if (button.dataset.action === "detail") showDetail(item);
  if (button.dataset.action === "admin-done") completeItem(item.id);
}

async function handleAdminEditSubmit(event) {
  event.preventDefault();

  if (!isAdminAuthenticated()) {
    requireAdminLogin();
    return;
  }

  const id = els.adminQueueId.value;
  const current = queues.find((queue) => queue.id === id);
  if (!current) {
    showToast("Tahrirlanadigan navbat topilmadi.", "error");
    return;
  }

  const adminSecretCode = els.adminSecretCode.value.trim();
  const adminLocation = els.adminMapLocationText.value.trim();
  if (!/^\d{4}$/.test(adminSecretCode)) {
    showToast(
      "4 xonali kod faqat 4 ta raqamdan iborat bo'lishi kerak.",
      "error",
    );
    return;
  }

  if (isSecretCodeTaken(adminSecretCode, id)) {
    showToast("Bu son kiritilgan. Boshqa son kiriting.", "error");
    return;
  }

  if (!adminLocation) {
    showToast("Lokatsiyani kiriting yoki kartadan belgilang.", "error");
    return;
  }

  try {
    const updated = await updateQueue(id, {
      ...current,
      firstName: els.adminFirstName.value.trim(),
      lastName: els.adminLastName.value.trim(),
      phone: els.adminPhone.value.trim(),
      secretCode: adminSecretCode,
      location: adminLocation,
      mapLocation: els.adminMapLocation.value.trim(),
      date: els.adminDate.value,
      time: els.adminTime.value,
      note: els.adminNote.value.trim(),
    });

    queues = queues.map((queue) => (queue.id === id ? updated : queue));
    await logAdminAction("queue_update", updated, "Admin navbatni tahrirladi");
    closeAdminEdit();
    render();
    showToast("Admin panelda navbat yangilandi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

function editAdminItem(item) {
  if (!isAdminAuthenticated()) {
    requireAdminLogin();
    return;
  }

  els.adminQueueId.value = item.id;
  els.adminFirstName.value = item.firstName;
  els.adminLastName.value = item.lastName;
  els.adminPhone.value = item.phone;
  els.adminSecretCode.value = item.secretCode || "";
  setMapInputValue(
    els.adminMapLocation,
    els.adminMapLocationText,
    item.mapLocation || "",
    item.location,
  );
  els.adminDate.value = item.date;
  els.adminTime.value = item.time;
  els.adminNote.value = item.note;
  els.adminEditForm.hidden = false;
  els.adminEditForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeAdminEdit() {
  els.adminEditForm.reset();
  els.adminQueueId.value = "";
  els.adminEditForm.hidden = true;
}

function editItem(item) {
  els.queueId.value = item.id;
  els.firstName.value = item.firstName;
  els.lastName.value = item.lastName;
  els.phone.value = item.phone;
  els.secretCode.value = item.secretCode || "";
  setMapInputValue(
    els.mapLocation,
    els.mapLocationText,
    item.mapLocation || "",
    item.location,
  );
  els.date.value = item.date;
  els.time.value = item.time;
  els.note.value = item.note;
  document
    .querySelector("#add")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteItem(id) {
  if (!isAdminAuthenticated()) {
    requireAdminLogin();
    return;
  }

  const reason = window.prompt("Navbat nima uchun o'chirilmoqda?");
  if (reason === null) return;

  const cleanReason = reason.trim();
  if (!cleanReason) {
    showToast("O'chirish sababini kiriting.", "error");
    return;
  }

  const current = queues.find((queue) => queue.id === id);
  if (!current) return;

  try {
    const updated = await updateQueue(id, {
      ...current,
      status: "cancelled",
      cancelReason: cleanReason,
      cancelledAt: new Date().toISOString(),
    });
    queues = queues.map((item) => (item.id === id ? updated : item));
    await logAdminAction("queue_cancel", updated, cleanReason);
    render();
    showToast("Navbat bekor qilindi va sababi tarixga yozildi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

async function deleteHistoryItem(id) {
  if (!isAdminAuthenticated()) {
    requireAdminLogin();
    return;
  }

  const item = queues.find((queue) => queue.id === id);
  if (!item) {
    showToast("Tarixdagi navbat topilmadi.", "error");
    return;
  }

  const confirmed = window.confirm(
    `${item.firstName} ${item.lastName} tarixdan butunlay o'chirilsinmi? Bu foydalanuvchi tarixidan ham o'chadi.`,
  );
  if (!confirmed) return;

  try {
    await removeQueue(id);
    queues = queues.filter((queue) => queue.id !== id);
    await logAdminAction("queue_delete", item, "Tarixdan butunlay o'chirildi");
    render();
    showToast("Navbat admin va foydalanuvchi tarixidan o'chirildi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

async function completeItem(id) {
  if (!isAdminAuthenticated()) {
    requireAdminLogin();
    return;
  }

  const current = queues.find((queue) => queue.id === id);
  if (!current) return;

  try {
    const updated = await updateQueue(id, { ...current, status: "done" });
    queues = queues.map((item) => (item.id === id ? updated : item));
    await logAdminAction("queue_done", updated, "Navbat tugallandi");
    render();
    showToast("Navbat tugallangan deb belgilandi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

function showDetail(item) {
  const status = statusMeta(item.status);
  els.detailTitle.textContent = `${item.firstName} ${item.lastName}`;
  els.detailList.innerHTML = `
    <div class="detail-item">
      <span><i data-lucide="user"></i> Ism</span>
      <strong>${escapeHtml(item.firstName)}</strong>
    </div>
    <div class="detail-item">
      <span><i data-lucide="user-round"></i> Familya</span>
      <strong>${escapeHtml(item.lastName)}</strong>
    </div>
    <div class="detail-item">
      <span><i data-lucide="phone"></i> Telefon</span>
      <strong>${escapeHtml(item.phone)}</strong>
    </div>
    <div class="detail-item">
      <span><i data-lucide="map-pin"></i> Lokatsiya</span>
      <strong>${escapeHtml(item.location)}</strong>
    </div>
    ${
      item.mapLocation
        ? `<div class="detail-item">
            <span><i data-lucide="map"></i> Karta</span>
            <strong><a class="map-link" href="${escapeAttribute(item.mapLocation)}" target="_blank" rel="noreferrer">Kartada ochish</a></strong>
          </div>`
        : ""
    }
    <div class="detail-item">
      <span><i data-lucide="calendar-days"></i> Sana</span>
      <strong>${formatDate(item.date)}</strong>
    </div>
    <div class="detail-item">
      <span><i data-lucide="clock-3"></i> Soat</span>
      <strong>${item.time}</strong>
    </div>
    <div class="detail-item">
      <span><i data-lucide="activity"></i> Holati</span>
      <strong><span class="status ${item.status}">${status.icon} ${status.label}</span></strong>
    </div>
    <div class="detail-item">
      <span><i data-lucide="notebook-pen"></i> Izoh</span>
      <strong>${escapeHtml(item.note || "Izoh kiritilmagan.")}</strong>
    </div>
    ${
      item.status === "cancelled"
        ? `<div class="detail-item">
            <span><i data-lucide="message-square-warning"></i> Sabab</span>
            <strong>${escapeHtml(item.cancelReason || "Sabab kiritilmagan.")}</strong>
          </div>`
        : ""
    }
  `;
  els.detailModal.classList.add("open");
  els.detailModal.setAttribute("aria-hidden", "false");

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeDetail() {
  els.detailModal.classList.remove("open");
  els.detailModal.setAttribute("aria-hidden", "true");
}

function openMapPicker(target) {
  if (!window.L) {
    showToast("Karta yuklanmadi. Internet aloqasini tekshiring.", "error");
    return;
  }

  mapPickerField =
    target === "admin" ? els.adminMapLocation : els.mapLocation;
  mapPickerDisplay =
    target === "admin" ? els.adminMapLocationText : els.mapLocationText;
  const currentPosition = parseMapLocation(mapPickerField.value);
  const center = currentPosition || DEFAULT_MAP_POSITION;
  mapPickerPosition = currentPosition;
  els.mapPickerSearch.value = mapPickerDisplay.value || "";

  els.mapPickerModal.classList.add("open");
  els.mapPickerModal.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    if (!mapPickerMap) {
      mapPickerMap = window.L.map(els.mapPickerCanvas).setView(
        [center.lat, center.lng],
        center.zoom || DEFAULT_MAP_POSITION.zoom,
      );
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapPickerMap);
      mapPickerMap.on("click", (event) => {
        setMapPickerMarker(event.latlng.lat, event.latlng.lng);
      });
    }

    mapPickerMap.invalidateSize();
    mapPickerMap.setView(
      [center.lat, center.lng],
      center.zoom || DEFAULT_MAP_POSITION.zoom,
    );

    if (currentPosition) {
      setMapPickerMarker(currentPosition.lat, currentPosition.lng);
    } else if (mapPickerMarker) {
      mapPickerMap.removeLayer(mapPickerMarker);
      mapPickerMarker = null;
    }
  }, 80);
}

function closeMapPicker() {
  els.mapPickerModal.classList.remove("open");
  els.mapPickerModal.setAttribute("aria-hidden", "true");
}

async function searchMapLocation(event) {
  event.preventDefault();

  const query = els.mapPickerSearch.value.trim();
  if (!query) {
    showToast("Qidirish uchun manzil yozing.", "error");
    return;
  }

  try {
    const result = await getMapSearchResult(query);
    if (!result) {
      showToast("Bu manzil bo'yicha joy topilmadi.", "error");
      return;
    }

    const lat = Number(result.lat);
    const lng = Number(result.lon);
    setMapPickerMarker(lat, lng);
    mapPickerMap.setView([lat, lng], 16);
    els.mapPickerSearch.value = result.display_name || query;
    showToast("Joy topildi. Saqlash uchun tasdiqlang.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

async function saveMapPicker() {
  if (!mapPickerPosition || !mapPickerField || !mapPickerDisplay) {
    showToast("Kartada joy belgilang.", "error");
    return;
  }

  const value = `https://www.google.com/maps?q=${mapPickerPosition.lat},${mapPickerPosition.lng}`;
  setMapInputValue(mapPickerField, mapPickerDisplay, value, "Joy aniqlanmoqda...");
  const label = await getMapLocationText(mapPickerPosition);
  setMapInputValue(mapPickerField, mapPickerDisplay, value, label);
  closeMapPicker();
  showToast("Karta joyi belgilandi.", "success");
}

function setMapPickerMarker(lat, lng) {
  mapPickerPosition = {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };

  if (!mapPickerMarker) {
    mapPickerMarker = window.L.marker([lat, lng]).addTo(mapPickerMap);
  } else {
    mapPickerMarker.setLatLng([lat, lng]);
  }
}

function matchesQueueFilter(item) {
  const itemDate = parseLocalDate(item.date);
  const start = startOfDay(today);
  const tomorrow = startOfDay(addDays(today, 1));
  const weekEnd = startOfDay(addDays(today, 7));
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  if (queueFilter === "today") return item.date === isoToday;
  if (queueFilter === "tomorrow") return item.date === toDateInput(tomorrow);
  if (queueFilter === "week") return itemDate >= start && itemDate < weekEnd;
  if (queueFilter === "month") return itemDate >= start && itemDate < monthEnd;
  return true;
}

function isSecretCodeTaken(secretCode, ignoredId = "") {
  return queues.some(
    (item) => item.id !== ignoredId && item.secretCode === secretCode,
  );
}

function matchesQuery(item, query, includeSecret = false) {
  if (!query) return true;
  const status = statusMeta(item.status);
  const values = [
    item.firstName,
    item.lastName,
    item.phone,
    item.location,
    item.mapLocation,
    item.date,
    item.time,
    item.note,
    item.cancelReason,
    status?.label,
    item.status,
  ];
  if (includeSecret) {
    values.push(item.secretCode);
  }

  return values.join(" ").toLowerCase().includes(query);
}

function normalizePhoneSearch(value) {
  return String(value || "").replace(/\D/g, "");
}

function statusMeta(status) {
  return {
    active: { label: "Faol", icon: "🔵" },
    done: { label: "Tugallangan", icon: "🟢" },
    cancelled: { label: "Bekor qilingan", icon: "🔴" },
  }[status];
}

function showToast(message, type, duration = 3200) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${toastIcon(type)}"></i><span>${escapeHtml(message)}</span>`;
  els.toastStack.appendChild(toast);

  if (window.lucide) {
    window.lucide.createIcons();
  }

  window.setTimeout(() => toast.remove(), duration);
}

function toastIcon(type) {
  return {
    success: "check-circle-2",
    warning: "bell-ring",
    error: "circle-alert",
  }[type] || "info";
}

function renderAdminAudit() {
  if (!els.adminAuditBody) return;

  els.adminAuditBody.innerHTML = adminLogs.length
    ? adminLogs.map(adminAuditRow).join("")
    : `<tr><td colspan="6" class="empty-row">Admin amallari hali yo'q.</td></tr>`;
}

function adminAuditRow(item) {
  return `
    <tr>
      <td>${formatDateTime(item.created || item.createdAt)}</td>
      <td>${escapeHtml(item.adminEmail || "-")}</td>
      <td>${escapeHtml(adminActionLabel(item.action))}</td>
      <td>${escapeHtml(item.queueTitle || "-")}</td>
      <td>${escapeHtml(item.queueId || "-")}</td>
      <td>${escapeHtml(item.note || "-")}</td>
    </tr>
  `;
}

function adminActionLabel(action) {
  return {
    login: "Kirish",
    logout: "Chiqish",
    queue_update: "Navbat tahrirlandi",
    queue_cancel: "Navbat bekor qilindi",
    queue_delete: "Navbat o'chirildi",
    queue_done: "Navbat tugallandi",
  }[action] || action;
}

function selectRole(role) {
  document.body.classList.add("role-selected");
  document.body.classList.toggle("admin-mode", role === "admin");
  document.body.classList.toggle("user-mode", role === "user");
  els.roleSwitch.hidden = role !== "admin";
  els.adminPanelButton.hidden = role === "admin";
  updateActiveMenu(role === "admin" ? "#adminHome" : "#home");
  render();
}

function showAdminLogin() {
  const lock = getAdminLoginLock();
  if (lock.lockedUntil > Date.now()) {
    showToast(getAdminLockMessage(lock.lockedUntil), "error");
    return;
  }

  els.adminLoginModal.classList.add("open");
  els.adminLoginModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => els.adminLogin.focus(), 80);
}

function hideAdminLogin() {
  els.adminLoginForm.reset();
  els.adminLoginModal.classList.remove("open");
  els.adminLoginModal.setAttribute("aria-hidden", "true");
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const login = normalizeAdminLogin(els.adminLogin.value);
  const password = els.adminPassword.value;
  const lock = getAdminLoginLock();

  if (lock.lockedUntil > Date.now()) {
    showToast(getAdminLockMessage(lock.lockedUntil), "error");
    return;
  }

  try {
    await pb.collection("admins").authWithPassword(login, password);
    clearAdminLoginLock();
    await logAdminAction("login", null, "Admin panelga kirdi");
    hideAdminLogin();
    selectRole("admin");
    await loadAdminLogs();
    showToast("Admin panelga xush kelibsiz.", "success");
  } catch (error) {
    const updatedLock = registerFailedAdminLogin();
    const attemptsLeft = Math.max(
      ADMIN_LOGIN_MAX_ATTEMPTS - updatedLock.attempts,
      0,
    );

    if (updatedLock.lockedUntil > Date.now()) {
      showToast(getAdminLockMessage(updatedLock.lockedUntil), "error");
    } else {
      showToast(
        `Login yoki parol noto'g'ri. Qolgan urinishlar: ${attemptsLeft}.`,
        "error",
      );
    }
  }
}

async function resetRole() {
  if (isAdminAuthenticated()) {
    await logAdminAction("logout", null, "Admin paneldan chiqdi");
  }

  pb.authStore.clear();
  adminLogs = [];
  selectRole("user");
  els.navLinks.classList.remove("open");
  closeAdminEdit();
  hideAdminLogin();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function restoreAdminSession() {
  if (!isAdminAuthenticated()) {
    pb.authStore.clear();
    selectRole("user");
    return;
  }

  try {
    await pb.collection("admins").authRefresh();
    selectRole("admin");
    await loadAdminLogs();
  } catch (error) {
    pb.authStore.clear();
    adminLogs = [];
    selectRole("user");
  }
}

function isAdminAuthenticated() {
  return (
    pb.authStore.isValid &&
    pb.authStore.record?.collectionName === "admins"
  );
}

function requireAdminLogin() {
  pb.authStore.clear();
  selectRole("user");
  showToast("Admin amalini bajarish uchun avval kiring.", "error");
  showAdminLogin();
}

function normalizeAdminLogin(value) {
  const login = value.trim().toLowerCase();
  return login.includes("@") ? login : `${login}@${ADMIN_LOGIN_DOMAIN}`;
}

function getAdminLoginLock() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_LOGIN_LOCK_KEY)) || {
      attempts: 0,
      lockedUntil: 0,
    };
  } catch (error) {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function registerFailedAdminLogin() {
  const current = getAdminLoginLock();
  const nextAttempts =
    current.lockedUntil > Date.now() ? current.attempts : current.attempts + 1;
  const nextLock = {
    attempts: nextAttempts,
    lockedUntil:
      nextAttempts >= ADMIN_LOGIN_MAX_ATTEMPTS
        ? Date.now() + ADMIN_LOGIN_LOCK_MS
        : 0,
  };

  localStorage.setItem(ADMIN_LOGIN_LOCK_KEY, JSON.stringify(nextLock));
  return nextLock;
}

function clearAdminLoginLock() {
  localStorage.removeItem(ADMIN_LOGIN_LOCK_KEY);
}

function getAdminLockMessage(lockedUntil) {
  const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
  return `Juda ko'p noto'g'ri urinish. ${minutes} daqiqadan keyin qayta urinib ko'ring.`;
}

function updateActiveMenu(forcedHash) {
  const menuLinks = Array.from(
    document.querySelectorAll(".nav-links a, .nav-actions a"),
  );
  const isAdminMode = document.body.classList.contains("admin-mode");
  const scopedLinks = menuLinks.filter((link) => {
    if (link.classList.contains("admin-nav-link")) return isAdminMode;
    if (link.classList.contains("user-nav-link")) return !isAdminMode;
    return !isAdminMode;
  });
  const hashes = scopedLinks
    .map((link) => link.getAttribute("href"))
    .filter((href) => href && href.startsWith("#"));
  const fallbackHash = isAdminMode ? "#adminHome" : "#home";
  const activeHash = forcedHash || getActiveSectionHash(hashes) || fallbackHash;

  menuLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === activeHash;
    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function getActiveSectionHash(hashes) {
  const scrollPoint = window.scrollY + 120;
  const currentSection = hashes
    .map((hash) => document.querySelector(hash))
    .filter(Boolean)
    .filter((section) => section.offsetTop <= scrollPoint)
    .pop();

  return currentSection ? `#${currentSection.id}` : "#home";
}

function setInitialTheme() {
  updateThemeIcon();
}

function toggleTheme() {
  document.body.classList.toggle("light");
  updateThemeIcon();
}

function updateThemeIcon() {
  els.themeToggle.innerHTML = document.body.classList.contains("light")
    ? '<i data-lucide="sun"></i>'
    : '<i data-lucide="moon"></i>';

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function refreshQueues() {
  try {
    queues = completeExpiredQueues(await loadQueues(), true);
    if (isAdminAuthenticated()) {
      await loadAdminLogs();
    }
  } catch (error) {
    showToast(getStorageError(error), "error");
  }

  render();
  checkQueueReminders();
}

async function loadQueues() {
  const response = await pb.collection("queues").getList(1, 500, {
    sort: "-createdAt",
  });

  if (!Array.isArray(response.items)) {
    throw new Error("PocketBase javobi noto'g'ri.");
  }

  return response.items.map(normalizeQueue).sort(sortByNewest);
}

async function createQueue(item) {
  const created = completeExpiredQueue(
    normalizeQueue({
      ...item,
      createdAt: new Date().toISOString(),
    }),
  );

  return normalizeQueue(
    await pb.collection("queues").create(created),
  );
}

async function updateQueue(id, item) {
  const updated = completeExpiredQueue(normalizeQueue({ ...item, id }));

  return normalizeQueue(
    await pb.collection("queues").update(id, updated),
  );
}

async function removeQueue(id) {
  await pb.collection("queues").delete(id);
}

async function loadAdminLogs() {
  if (!isAdminAuthenticated()) {
    adminLogs = [];
    return;
  }

  const response = await pb.collection("admin_logs").getList(1, 100, {
    sort: "-created",
  });

  adminLogs = Array.isArray(response.items) ? response.items : [];
}

async function logAdminAction(action, queue, note = "") {
  if (!isAdminAuthenticated()) return;

  const adminEmail = pb.authStore.record?.email || "admin";
  const queueTitle = queue
    ? `${queue.firstName || ""} ${queue.lastName || ""}`.trim()
    : "";

  try {
    const created = await pb.collection("admin_logs").create({
      action,
      adminId: pb.authStore.record?.id || "",
      adminEmail,
      queueId: queue?.id || "",
      queueTitle,
      note,
      createdAt: new Date().toISOString(),
    });

    adminLogs = [created, ...adminLogs].slice(0, 100);
    renderAdminAudit();
  } catch (error) {
    showToast("Admin amal tarixi saqlanmadi.", "warning");
  }
}

function completeExpiredQueue(item) {
  if (item.status === "active" && isQueueTimePassed(item)) {
    return { ...item, status: "done" };
  }

  return item;
}

function completeExpiredQueues(items, shouldSave = false) {
  const updated = items.map(completeExpiredQueue);
  const hasChanges = updated.some((item, index) => item !== items[index]);

  if (hasChanges && shouldSave && isAdminAuthenticated()) {
    updated.forEach((item) => {
      const original = items.find((queue) => queue.id === item.id);

      if (original !== item) {
        updateQueue(item.id, item).catch((error) =>
          showToast(getStorageError(error), "error"),
        );
      }
    });
  }

  return updated;
}

function syncExpiredQueues() {
  if (!isAdminAuthenticated()) return;

  const updated = completeExpiredQueues(queues);
  const hasChanges = updated.some((item, index) => item !== queues[index]);

  if (!hasChanges) return;

  const previous = queues;
  queues = updated;
  updated.forEach((item, index) => {
    if (item !== previous[index]) {
      updateQueue(item.id, item).catch((error) =>
        showToast(getStorageError(error), "error"),
      );
    }
  });
  render();
}

function checkQueueReminders(now = new Date()) {
  queues
    .filter((item) => item.status === "active")
    .forEach((item) => {
      const queueDate = getQueueDateTime(item);
      const diff = queueDate - now;
      const reminderKey = `${item.id}-${item.date}-${item.time}`;

      if (diff < 0 || diff > REMINDER_WINDOW_MS || shownReminders.has(reminderKey)) {
        return;
      }

      shownReminders.add(reminderKey);
      const dayLabel = item.date === isoToday ? "bugun" : formatDate(item.date);
      showToast(
        `Eslatma: ${item.firstName} ${item.lastName}ning navbati ${dayLabel} ${item.time} da.`,
        "warning",
        9000,
      );
    });
}

function renderPersistentReminder(now = new Date()) {
  const nextQueue = getNearestActiveQueue(now);

  if (!nextQueue) {
    els.queueReminderBar.hidden = true;
    return;
  }

  const queueDate = getQueueDateTime(nextQueue);
  const dayLabel = formatReminderDay(nextQueue.date, now);
  els.queueReminderText.textContent =
    `${nextQueue.firstName} ${nextQueue.lastName}ning navbati ${dayLabel} ${nextQueue.time} da.`;
  els.queueReminderTime.textContent = `Qoldi: ${formatTimeUntil(queueDate - now)}`;
  els.queueReminderBar.hidden = false;
}

function getNearestActiveQueue(now = new Date()) {
  return queues
    .filter((item) => item.status === "active")
    .map((item) => ({ item, date: getQueueDateTime(item) }))
    .filter(({ date }) => date >= now)
    .sort((a, b) => a.date - b.date)[0]?.item || null;
}

function normalizeQueue(item) {
  return {
    id: item.id,
    firstName: item.firstName || "",
    lastName: item.lastName || "",
    phone: item.phone || "",
    secretCode: item.secretCode || "",
    location: item.location || formatMapLocation(item.mapLocation) || "",
    mapLocation: item.mapLocation || "",
    date: item.date || isoToday,
    time: item.time || "00:00",
    note: item.note || "",
    status: item.status || "active",
    cancelReason: item.cancelReason || "",
    cancelledAt: item.cancelledAt || "",
    createdAt: item.createdAt || item.created || new Date().toISOString(),
  };
}

function sortByNewest(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function mapLocationLink(item) {
  if (!item.mapLocation) return "";

  return `<a class="meta map-link" href="${escapeAttribute(item.mapLocation)}" target="_blank" rel="noreferrer"><i data-lucide="map"></i> Kartada ochish</a>`;
}

function mapLocationTableCell(item) {
  if (!item.mapLocation) return "-";

  return `<a class="map-link" href="${escapeAttribute(item.mapLocation)}" target="_blank" rel="noreferrer">Kartada ochish</a>`;
}

function locationTableCell(item) {
  const location = escapeHtml(item.location || "-");
  const mapLink = mapLocationTableCell(item);

  return item.mapLocation ? `${location}<br>${mapLink}` : location;
}

function setMapInputValue(field, display, value, label = "") {
  field.value = value || "";
  display.value = label || formatMapLocation(value);
}

async function getMapLocationText(position) {
  const fallback = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", position.lat);
  url.searchParams.set("lon", position.lng);
  url.searchParams.set("accept-language", "uz");

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;

    const data = await response.json();
    return data.display_name || fallback;
  } catch {
    return fallback;
  }
}

async function getMapSearchResult(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "uz");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Manzil qidirishda xatolik yuz berdi.");
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : null;
}

function formatMapLocation(value) {
  const location = parseMapLocation(value);

  if (!location) return "";

  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}

function parseMapLocation(value) {
  const cleanValue = String(value || "");
  const match =
    cleanValue.match(/q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
    cleanValue.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
    cleanValue.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);

  if (!match) return null;

  return {
    lat: Number(match[1]),
    lng: Number(match[2]),
  };
}

function getStorageError(error) {
  const message = error?.response?.message || error?.message || "";

  if (/something went wrong|failed to fetch|networkerror/i.test(message)) {
    return "PocketBase serveriga ulanib bo'lmadi. Server ishga tushganini tekshiring.";
  }

  return message || "Ma'lumotni saqlashda xatolik yuz berdi.";
}

function revealOnScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.14 },
  );

  document
    .querySelectorAll(".reveal")
    .forEach((item) => observer.observe(item));
}

function emptyState(text) {
  return `<div class="empty-state reveal visible"><p>${text}</p></div>`;
}

function drawBarChart(canvas, data) {
  const context = prepareCanvas(canvas);
  if (!context) return;

  const { ctx, width, height } = context;
  const padding = { top: 18, right: 16, bottom: 34, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const barGap = 10;
  const barWidth = (chartWidth - barGap * (data.length - 1)) / data.length;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.stroke();

  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding.left + index * (barWidth + barGap);
    const y = padding.top + chartHeight - barHeight;

    const gradient = ctx.createLinearGradient(0, y, 0, padding.top + chartHeight);
    gradient.addColorStop(0, "#22c55e");
    gradient.addColorStop(1, "rgba(34, 197, 94, 0.28)");
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, Math.max(barHeight, 4), 8);
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.value, x + barWidth / 2, Math.max(y - 8, 14));

    ctx.fillStyle = "rgba(203, 213, 225, 0.82)";
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText(item.label, x + barWidth / 2, height - 10);
  });
}

function drawDoughnutChart(canvas, data) {
  const context = prepareCanvas(canvas);
  if (!context) return;

  const { ctx, width, height } = context;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = Math.min(width, height) * 0.32;
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.clearRect(0, 0, width, height);

  if (!total) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let start = -Math.PI / 2;
    data.forEach((item) => {
      const angle = (item.value / total) * Math.PI * 2;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 24;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, start, start + angle);
      ctx.stroke();
      start += angle;
    });
  }

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 34px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(total, centerX, centerY - 8);
  ctx.fillStyle = "rgba(203, 213, 225, 0.82)";
  ctx.font = "700 13px Inter, sans-serif";
  ctx.fillText("jami", centerX, centerY + 22);
}

function prepareCanvas(canvas) {
  if (!canvas) return null;

  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.floor(rect.width), 260);
  const height = Math.max(Math.floor(rect.height), 220);
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function renderChartLegend(data) {
  els.monthlyChartLegend.innerHTML = data
    .map(
      (item) => `
        <span>
          <i style="background:${item.color}"></i>
          ${item.label}: <strong>${item.value}</strong>
        </span>
      `,
    )
    .join("");
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function formatDate(value) {
  if (!value) return "-";

  const [year, month, day] = value.split("-");
  const monthInitials = [
    "Y",
    "F",
    "M",
    "A",
    "M",
    "I",
    "I",
    "A",
    "S",
    "O",
    "N",
    "D",
  ];
  const monthInitial = monthInitials[Number(month) - 1] || "";
  return `${year},${monthInitial}${month}.${day}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${toDateInput(date)} ${date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatReminderDay(value, now = new Date()) {
  const todayValue = toDateInput(now);
  const tomorrowValue = toDateInput(addDays(now, 1));

  if (value === todayValue) return "bugun";
  if (value === tomorrowValue) return "ertaga";
  return formatDate(value);
}

function formatTimeUntil(milliseconds) {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} kun ${hours} soat`;
  if (hours > 0) return `${hours} soat ${minutes} daqiqa`;
  if (minutes > 0) return `${minutes} daqiqa ${seconds} soniya`;
  return `${seconds} soniya`;
}

function toDateInput(date) {
  const normalized = new Date(date);
  normalized.setMinutes(
    normalized.getMinutes() - normalized.getTimezoneOffset(),
  );
  return normalized.toISOString().slice(0, 10);
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isQueueTimePassed(item, now = new Date()) {
  const queueDate = getQueueDateTime(item);
  const year = queueDate.getFullYear();
  const month = queueDate.getMonth() + 1;
  const day = queueDate.getDate();
  const hours = queueDate.getHours();
  const minutes = queueDate.getMinutes();

  if (now.getFullYear() !== year) return now.getFullYear() > year;
  if (now.getMonth() + 1 !== month) return now.getMonth() + 1 > month;
  if (now.getDate() !== day) return now.getDate() > day;
  if (now.getHours() !== hours) return now.getHours() > hours;
  return now.getMinutes() >= minutes;
}

function getQueueDateTime(item) {
  const [year, month, day] = item.date.split("-").map(Number);
  const [hours = 0, minutes = 0] = item.time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) =>
    startOfDay(addDays(today, index - 6)),
  );
}

function isDateBetween(value, start, end) {
  const date = parseLocalDate(value);
  return date >= startOfDay(start) && date < startOfDay(end);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

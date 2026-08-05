const today = new Date();
const isoToday = toDateInput(today);

const AUTO_COMPLETE_INTERVAL_MS = 1000;
const PB_API_BASE =
  window.location.protocol === "http:" || window.location.protocol === "https:"
    ? window.location.origin
    : "http://127.0.0.1:8090";
const QUEUES_ENDPOINT = `${PB_API_BASE}/api/collections/queues/records`;

let queues = [];
let queueFilter = "all";
let queueQuery = "";
let historyQuery = "";
let statusFilter = "all";

const els = {
  loader: document.querySelector("#loader"),
  roleGate: document.querySelector("#roleGate"),
  roleSwitch: document.querySelector("#roleSwitch"),
  roleGrid: document.querySelector(".role-grid"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminLogin: document.querySelector("#adminLogin"),
  adminPassword: document.querySelector("#adminPassword"),
  adminLoginCancel: document.querySelector("#adminLoginCancel"),
  themeToggle: document.querySelector("#themeToggle"),
  menuToggle: document.querySelector("#menuToggle"),
  navLinks: document.querySelector("#navLinks"),
  form: document.querySelector("#queueForm"),
  queueId: document.querySelector("#queueId"),
  firstName: document.querySelector("#firstName"),
  lastName: document.querySelector("#lastName"),
  phone: document.querySelector("#phone"),
  secretCode: document.querySelector("#secretCode"),
  location: document.querySelector("#location"),
  date: document.querySelector("#date"),
  time: document.querySelector("#time"),
  note: document.querySelector("#note"),
  latestGrid: document.querySelector("#latestGrid"),
  queueGrid: document.querySelector("#queueGrid"),
  historyBody: document.querySelector("#historyBody"),
  adminGrid: document.querySelector("#adminGrid"),
  adminHistoryBody: document.querySelector("#adminHistoryBody"),
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
  totalCount: document.querySelector("#totalCount"),
  activeCount: document.querySelector("#activeCount"),
  doneCount: document.querySelector("#doneCount"),
  cancelledCount: document.querySelector("#cancelledCount"),
  adminEditForm: document.querySelector("#adminEditForm"),
  adminQueueId: document.querySelector("#adminQueueId"),
  adminFirstName: document.querySelector("#adminFirstName"),
  adminLastName: document.querySelector("#adminLastName"),
  adminPhone: document.querySelector("#adminPhone"),
  adminSecretCode: document.querySelector("#adminSecretCode"),
  adminLocation: document.querySelector("#adminLocation"),
  adminDate: document.querySelector("#adminDate"),
  adminTime: document.querySelector("#adminTime"),
  adminNote: document.querySelector("#adminNote"),
  adminCancelEdit: document.querySelector("#adminCancelEdit"),
};

document.addEventListener("DOMContentLoaded", async () => {
  setInitialTheme();
  els.date.min = isoToday;
  bindEvents();
  await refreshQueues();
  revealOnScroll();
  updateActiveMenu();
  window.setTimeout(() => els.loader.classList.add("hidden"), 550);
  window.setInterval(syncExpiredQueues, AUTO_COMPLETE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshQueues();
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

function bindEvents() {
  document.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () =>
      handleRoleClick(button.dataset.role),
    );
  });

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

  els.form.addEventListener("submit", handleSubmit);
  els.adminEditForm.addEventListener("submit", handleAdminEditSubmit);
  els.adminCancelEdit.addEventListener("click", closeAdminEdit);
  els.detailModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-detail]")) {
      closeDetail();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetail();
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
    location: els.location.value.trim(),
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
    render();
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
  renderHeroStats();

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
    .filter((item) => item.status === "active")
    .filter(matchesQueueFilter)
    .filter((item) => matchesQuery(item, queueQuery));

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
  return `
    <article class="queue-card reveal visible">
      <h3 class="person-title"><i data-lucide="user"></i> ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</h3>
      <div class="meta-list">
        <span class="meta"><i data-lucide="phone"></i> ${escapeHtml(item.phone)}</span>
        <span class="meta"><i data-lucide="map-pin"></i> ${escapeHtml(item.location)}</span>
        <span class="meta"><i data-lucide="calendar-days"></i> ${formatDate(item.date)}</span>
        <span class="meta"><i data-lucide="clock-3"></i> ${item.time}</span>
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
        <span class="meta"><i data-lucide="calendar-days"></i> ${formatDate(item.date)}</span>
        <span class="meta"><i data-lucide="clock-3"></i> ${item.time}</span>
        <span class="meta"><span class="status ${item.status}">${status.icon} ${status.label}</span></span>
      </div>
      <p>${escapeHtml(item.note || "Izoh kiritilmagan.")}</p>
      <div class="card-actions">
        <button class="action-button" data-action="admin-edit" data-id="${item.id}" type="button" aria-label="Edit"><i data-lucide="pencil"></i></button>
        <button class="action-button danger" data-action="delete" data-id="${item.id}" type="button" aria-label="Delete"><i data-lucide="trash-2"></i></button>
        <button class="action-button" data-action="done" data-id="${item.id}" type="button" aria-label="Tugallash"><i data-lucide="check"></i></button>
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
      <td>${escapeHtml(item.location)}</td>
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
      <td>${escapeHtml(item.location)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${item.time}</td>
      <td><span class="status ${item.status}">${status.icon} ${status.label}</span></td>
      <td>${escapeHtml(item.cancelReason || "-")}</td>
      <td>
        <button class="action-button danger" data-action="delete-history" data-id="${item.id}" type="button" aria-label="Tarixdan o'chirish">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `;
}

function handleCardAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const item = queues.find((queue) => queue.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "edit") editItem(item);
  if (button.dataset.action === "admin-edit") editAdminItem(item);
  if (button.dataset.action === "delete") deleteItem(item.id);
  if (button.dataset.action === "delete-history") deleteHistoryItem(item.id);
  if (button.dataset.action === "detail") showDetail(item);
  if (button.dataset.action === "done") completeItem(item.id);
}

async function handleAdminEditSubmit(event) {
  event.preventDefault();

  const id = els.adminQueueId.value;
  const current = queues.find((queue) => queue.id === id);
  if (!current) {
    showToast("Tahrirlanadigan navbat topilmadi.", "error");
    return;
  }

  const adminSecretCode = els.adminSecretCode.value.trim();
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

  try {
    const updated = await updateQueue(id, {
      ...current,
      firstName: els.adminFirstName.value.trim(),
      lastName: els.adminLastName.value.trim(),
      phone: els.adminPhone.value.trim(),
      secretCode: adminSecretCode,
      location: els.adminLocation.value.trim(),
      date: els.adminDate.value,
      time: els.adminTime.value,
      note: els.adminNote.value.trim(),
    });

    queues = queues.map((queue) => (queue.id === id ? updated : queue));
    closeAdminEdit();
    render();
    showToast("Admin panelda navbat yangilandi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

function editAdminItem(item) {
  els.adminQueueId.value = item.id;
  els.adminFirstName.value = item.firstName;
  els.adminLastName.value = item.lastName;
  els.adminPhone.value = item.phone;
  els.adminSecretCode.value = item.secretCode || "";
  els.adminLocation.value = item.location;
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
  els.location.value = item.location;
  els.date.value = item.date;
  els.time.value = item.time;
  els.note.value = item.note;
  document
    .querySelector("#add")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteItem(id) {
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
    render();
    showToast("Navbat bekor qilindi va sababi tarixga yozildi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

async function deleteHistoryItem(id) {
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
    render();
    showToast("Navbat admin va foydalanuvchi tarixidan o'chirildi.", "success");
  } catch (error) {
    showToast(getStorageError(error), "error");
  }
}

async function completeItem(id) {
  const current = queues.find((queue) => queue.id === id);
  if (!current) return;

  try {
    const updated = await updateQueue(id, { ...current, status: "done" });
    queues = queues.map((item) => (item.id === id ? updated : item));
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
  const values = [
    item.firstName,
    item.lastName,
    item.phone,
    item.location,
    item.date,
    item.time,
    item.note,
    item.cancelReason,
  ];
  if (includeSecret) {
    values.push(item.secretCode);
  }

  return values.join(" ").toLowerCase().includes(query);
}

function statusMeta(status) {
  return {
    active: { label: "Faol", icon: "🔵" },
    done: { label: "Tugallangan", icon: "🟢" },
    cancelled: { label: "Bekor qilingan", icon: "🔴" },
  }[status];
}

function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === "success" ? "check-circle-2" : "circle-alert"}"></i><span>${escapeHtml(message)}</span>`;
  els.toastStack.appendChild(toast);

  if (window.lucide) {
    window.lucide.createIcons();
  }

  window.setTimeout(() => toast.remove(), 3200);
}

function selectRole(role) {
  document.body.classList.add("role-selected");
  document.body.classList.toggle("admin-mode", role === "admin");
  document.body.classList.toggle("user-mode", role === "user");
  els.roleSwitch.querySelector("span").textContent =
    role === "admin" ? "Admin chiqish" : "Chiqish";
  updateActiveMenu(role === "admin" ? "#adminHome" : "#home");
  render();
}

function handleRoleClick(role) {
  if (role === "admin") {
    showAdminLogin();
    return;
  }

  selectRole("user");
}

function showAdminLogin() {
  els.roleGrid.hidden = true;
  els.adminLoginForm.hidden = false;
  els.adminLogin.focus();
}

function hideAdminLogin() {
  els.adminLoginForm.reset();
  els.adminLoginForm.hidden = true;
  els.roleGrid.hidden = false;
}

function handleAdminLogin(event) {
  event.preventDefault();

  const login = els.adminLogin.value.trim();
  const password = els.adminPassword.value;

  if (login === "admin" && password === "admin123") {
    hideAdminLogin();
    selectRole("admin");
    showToast("Admin panelga xush kelibsiz.", "success");
    return;
  }

  showToast("Login yoki parol noto'g'ri.", "error");
}

function resetRole() {
  document.body.classList.remove("role-selected", "admin-mode", "user-mode");
  els.navLinks.classList.remove("open");
  updateActiveMenu("#home");
  closeAdminEdit();
  hideAdminLogin();
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  } catch (error) {
    showToast(getStorageError(error), "error");
  }

  render();
}

async function loadQueues() {
  const response = await pbRequest(
    `${QUEUES_ENDPOINT}?perPage=500&sort=-createdAt`,
  );

  return response.items.map(normalizeQueue).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

async function createQueue(item) {
  const created = completeExpiredQueue(
    normalizeQueue({
      ...item,
      createdAt: new Date().toISOString(),
    }),
  );

  return normalizeQueue(
    await pbRequest(QUEUES_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(created),
    }),
  );
}

async function updateQueue(id, item) {
  const updated = completeExpiredQueue(normalizeQueue({ ...item, id }));

  return normalizeQueue(
    await pbRequest(`${QUEUES_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updated),
    }),
  );
}

async function removeQueue(id) {
  await pbRequest(`${QUEUES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
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

  if (hasChanges && shouldSave) {
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

function normalizeQueue(item) {
  return {
    id: item.id,
    firstName: item.firstName || "",
    lastName: item.lastName || "",
    phone: item.phone || "",
    secretCode: item.secretCode || "",
    location: item.location || "",
    date: item.date || isoToday,
    time: item.time || "00:00",
    note: item.note || "",
    status: item.status || "active",
    cancelReason: item.cancelReason || "",
    cancelledAt: item.cancelledAt || "",
    createdAt: item.createdAt || item.created || new Date().toISOString(),
  };
}

async function pbRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "PocketBase bilan bog'lanishda xatolik.");
  }

  return data;
}

function getStorageError(error) {
  return error?.message || "Ma'lumotni saqlashda xatolik yuz berdi.";
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

function formatDate(value) {
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
  const [year, month, day] = item.date.split("-").map(Number);
  const [hours = 0, minutes = 0] = item.time.split(":").map(Number);

  if (now.getFullYear() !== year) return now.getFullYear() > year;
  if (now.getMonth() + 1 !== month) return now.getMonth() + 1 > month;
  if (now.getDate() !== day) return now.getDate() > day;
  if (now.getHours() !== hours) return now.getHours() > hours;
  return now.getMinutes() >= minutes;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

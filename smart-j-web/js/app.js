/**
 * SMART-J FRONTEND CONTROLLER - TAHAP 1
 * Login, Role-Based Navigation, & KPI Dashboard Summary
 */

const ROLE_MENUS = {
  ADMIN: [
    { id: "dashboard", label: "Dashboard Ringkasan", icon: "fa-chart-pie" },
    { id: "master_data", label: "Master Data & PO", icon: "fa-database" },
    { id: "users_vendors", label: "Manajemen User & Vendor", icon: "fa-users-gear" },
    { id: "deliveries", label: "Monitoring Pengiriman", icon: "fa-truck-fast" },
    { id: "receiving_mrr", label: "Penerimaan & MRR", icon: "fa-clipboard-check" },
    { id: "inspection", label: "Pemeriksaan Material", icon: "fa-magnifying-glass-chart" },
    { id: "closing", label: "BA Closing", icon: "fa-file-signature" }
  ],
  VENDOR: [
    { id: "dashboard", label: "Dashboard Vendor", icon: "fa-chart-pie" },
    { id: "vendor_po", label: "PO & Kuota Pengiriman", icon: "fa-file-contract" },
    { id: "deliveries", label: "Rencana Pengiriman", icon: "fa-truck-ramp-box" },
    { id: "inspection", label: "Status Pemeriksaan & NG", icon: "fa-screwdriver-wrench" },
    { id: "closing", label: "Dokumen BA Closing", icon: "fa-file-pdf" }
  ],
  RECEIVING: [
    { id: "dashboard", label: "Dashboard Receiving", icon: "fa-chart-pie" },
    { id: "deliveries", label: "Validasi Kedatangan", icon: "fa-truck-front" },
    { id: "receiving_mrr", label: "Penerbitan MRR Digital", icon: "fa-file-invoice" },
    { id: "inspection", label: "Penugasan Inspector", icon: "fa-user-check" },
    { id: "closing", label: "Upload PDF BA Closing", icon: "fa-file-arrow-up" }
  ],
  INSPECTOR: [
    { id: "dashboard", label: "Dashboard Inspector", icon: "fa-chart-pie" },
    { id: "inspection", label: "Antrian Pemeriksaan QC", icon: "fa-microscope" },
    { id: "receiving_mrr", label: "Daftar MRR Terbit", icon: "fa-list-check" }
  ]
};

let currentActiveTab = "dashboard";

document.addEventListener("DOMContentLoaded", () => {
  console.log(
    "%c SMART-J v1.0 %c Developed by Allif Cendikiawan — Quality Engineer ",
    "background:#1e3a8a;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;",
    "background:#0f172a;color:#38bdf8;font-weight:bold;padding:4px 8px;border-radius:0 4px 4px 0;"
  );
  bindLoginEvents();
  bindDashboardEvents();
  initApp();
});

function initApp() {
  const token = SmartJApi.getToken();
  const user = SmartJApi.getUser();

  if (token && user) {
    showDashboard(user);
  } else {
    showLogin();
  }
}

// =========================================================================
// LOGIKA HALAMAN LOGIN & KONEKSI API
// =========================================================================
function bindLoginEvents() {
  const loginForm = document.getElementById("loginForm");
  const togglePwdBtn = document.getElementById("togglePasswordBtn");
  const pwdInput = document.getElementById("loginPassword");
  const pingApiBtn = document.getElementById("pingApiBtn");
  const toggleApiConfigBtn = document.getElementById("toggleApiConfigBtn");
  const apiConfigBox = document.getElementById("apiConfigBox");
  const customApiUrlInput = document.getElementById("customApiUrlInput");
  const saveApiUrlBtn = document.getElementById("saveApiUrlBtn");
  const resetApiUrlBtn = document.getElementById("resetApiUrlBtn");

  customApiUrlInput.value = getApiUrl();

  togglePwdBtn.addEventListener("click", () => {
    const isPwd = pwdInput.type === "password";
    pwdInput.type = isPwd ? "text" : "password";
    togglePwdBtn.innerHTML = isPwd
      ? '<i class="fa-solid fa-eye-slash"></i>'
      : '<i class="fa-solid fa-eye"></i>';
  });

  toggleApiConfigBtn.addEventListener("click", () => {
    apiConfigBox.classList.toggle("hidden");
  });

  saveApiUrlBtn.addEventListener("click", () => {
    const val = customApiUrlInput.value.trim();
    if (!val.startsWith("https://script.google.com/")) {
      showLoginAlert("URL harus diawali https://script.google.com/...", "error");
      return;
    }
    localStorage.setItem(SMARTJ_CONFIG.STORAGE_API_OVERRIDE_KEY, val);
    showLoginAlert("URL API disimpan untuk sesi browser ini.", "success");
  });

  resetApiUrlBtn.addEventListener("click", () => {
    localStorage.removeItem(SMARTJ_CONFIG.STORAGE_API_OVERRIDE_KEY);
    customApiUrlInput.value = getApiUrl();
    showLoginAlert("URL API dikembalikan ke konfigurasi default.", "success");
  });

  pingApiBtn.addEventListener("click", async () => {
    pingApiBtn.disabled = true;
    pingApiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Mengecek...</span>';
    try {
      const res = await SmartJApi.checkHealth();
      if (res.success) {
        showLoginAlert(`Terhubung ke ${res.application} (${res.database || "Database OK"})`, "success");
      } else {
        showLoginAlert(`API merespons error: ${res.message}`, "error");
      }
    } catch (err) {
      showLoginAlert(`Gagal terhubung ke API: ${err.message}. Pastikan URL /exec benar dan akses diset "Anyone".`, "error");
    } finally {
      pingApiBtn.disabled = false;
      pingApiBtn.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i><span>Cek Koneksi API</span>';
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const submitBtn = document.getElementById("loginSubmitBtn");

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Memverifikasi...</span>';
    hideLoginAlert();

    try {
      const res = await SmartJApi.post("login", { username, password }, false);
      if (!res.success) {
        showLoginAlert(res.message || "Login gagal.", "error");
        return;
      }
      SmartJApi.saveSession(res.token, res.user);
      showDashboard(res.user);
    } catch (err) {
      showLoginAlert("Terjadi kesalahan koneksi: " + err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Masuk ke Sistem</span><i class="fa-solid fa-arrow-right"></i>';
    }
  });
}

function showLoginAlert(message, type = "error") {
  const box = document.getElementById("loginAlert");
  box.className = type === "success"
    ? "p-3 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200"
    : "p-3 rounded-lg text-xs bg-red-50 text-red-800 border border-red-200";
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideLoginAlert() {
  document.getElementById("loginAlert").classList.add("hidden");
}

// =========================================================================
// LOGIKA DASHBOARD & ROLE NAVIGATION
// =========================================================================
function showLogin() {
  document.getElementById("dashboardView").classList.add("hidden");
  document.getElementById("loginView").classList.remove("hidden");
}

function showDashboard(user) {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("dashboardView").classList.remove("hidden");

  document.getElementById("sidebarFullName").textContent = user.fullName || user.username;
  document.getElementById("sidebarRoleBadge").textContent = user.role;
  document.getElementById("sidebarVendorId").textContent = user.vendorId ? `ID: ${user.vendorId}` : "";

  renderSidebarMenu(user.role);
  navigateToTab("dashboard");
}

function bindDashboardEvents() {
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await SmartJApi.post("logout", {}, true);
    } catch (e) {
      // Abaikan error jaringan saat logout
    }
    SmartJApi.clearSession();
    showLogin();
  });

  document.getElementById("refreshDataBtn").addEventListener("click", () => {
    navigateToTab(currentActiveTab);
  });
}

function renderSidebarMenu(role) {
  const nav = document.getElementById("sidebarMenu");
  const menus = ROLE_MENUS[role] || ROLE_MENUS.VENDOR;

  nav.innerHTML = menus.map(m => `
    <button data-tab="${m.id}"
      class="nav-tab-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left text-slate-300 hover:bg-slate-800 hover:text-white">
      <i class="fa-solid ${m.icon} w-5 text-center"></i>
      <span>${m.label}</span>
    </button>
  `).join("");

  nav.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateToTab(btn.getAttribute("data-tab"));
    });
  });
}

function navigateToTab(tabId) {
  currentActiveTab = tabId;
  const user = SmartJApi.getUser();
  if (!user) return showLogin();

  // Highlight menu aktif
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    const isActive = btn.getAttribute("data-tab") === tabId;
    btn.className = isActive
      ? "nav-tab-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition text-left bg-blue-700 text-white shadow-sm"
      : "nav-tab-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left text-slate-300 hover:bg-slate-800 hover:text-white";
  });

  if (tabId === "dashboard") {
    loadDashboardSummaryView(user);
  } else if (tabId === "users_vendors") {
    loadUsersVendorsView();
  } else if (tabId === "master_data") {
    loadMasterDataView(false);
  } else if (tabId === "vendor_po") {
    loadMasterDataView(true);
  } else if (tabId === "deliveries") {
    loadDeliveriesView(user);
  } else if (tabId === "receiving_mrr") {
    loadReceivingMRRView(user);
  } else if (tabId === "inspection") {
    loadInspectionView(user);
  } else if (tabId === "closing") {
    loadClosingView(user);
  } else {
    renderModulePlaceholder(tabId, user);
  }
}

async function loadDashboardSummaryView(user) {
  document.getElementById("pageTitle").textContent = `Dashboard ${user.role}`;
  document.getElementById("pageSubtitle").textContent = `Selamat datang, ${user.fullName} — Ringkasan status real-time SMART-J`;

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat data ringkasan dari server...</span>
    </div>
  `;

  try {
    const res = await SmartJApi.post("getDashboardSummary", {});
    if (!res.success) {
      throw new Error(res.message);
    }
    const s = res.summary;

    container.innerHTML = `
      <!-- Kartu KPI Utama -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpiCard("PO Aktif", s.totalPOActive, `Selesai: ${s.totalPOCompleted} PO`, "fa-file-contract", "blue")}
        ${kpiCard("Pengiriman Submitted", s.deliverySubmitted, `Revisi Dokumen: ${s.deliveryRevisionRequired}`, "fa-truck-fast", "indigo")}
        ${kpiCard("MRR Terbit", s.totalMRRIssued, `Antrian Inspeksi: ${s.waitingInspection}`, "fa-clipboard-check", "emerald")}
        ${kpiCard("BA Closing Selesai", s.closingCompleted, `Proses Closing: ${s.closingInProgress}`, "fa-file-signature", "teal")}
      </div>

      <!-- Status Siklus Pemeriksaan Material (QC & Perbaikan NG) -->
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="fa-solid fa-microscope text-blue-700"></i>
          <span>Status Pemeriksaan Material & Tindak Lanjut NG</span>
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div class="text-xs text-slate-500 font-medium">Menunggu Inspeksi Awal</div>
            <div class="text-2xl font-bold text-slate-800 mt-1">${s.waitingInspection}</div>
          </div>
          <div class="p-4 rounded-lg bg-red-50 border border-red-200">
            <div class="text-xs text-red-700 font-medium">NG - Menunggu Perbaikan Vendor</div>
            <div class="text-2xl font-bold text-red-700 mt-1">${s.waitingVendorCorrection}</div>
          </div>
          <div class="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div class="text-xs text-amber-800 font-medium">Siap Re-Inspection</div>
            <div class="text-2xl font-bold text-amber-700 mt-1">${s.readyForReinspection}</div>
          </div>
          <div class="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <div class="text-xs text-emerald-700 font-medium">Pemeriksaan OK (Siap/Sudah Closing)</div>
            <div class="text-2xl font-bold text-emerald-700 mt-1">${s.inspectionOK}</div>
          </div>
        </div>
      </div>

      <!-- Info Sesi & Hak Akses Aktif -->
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div class="space-y-1">
          <div><span class="font-semibold text-slate-800">User ID:</span> ${user.userId}</div>
          <div><span class="font-semibold text-slate-800">Role Akses:</span> ${user.role} ${user.vendorId ? `(Vendor ID: ${user.vendorId})` : "(Akses Internal Penuh)"}</div>
        </div>
        <div class="text-slate-400">
          Terhubung ke API: <span class="font-mono text-slate-600">${getApiUrl().slice(0, 52)}...</span>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
        <strong>Gagal memuat dashboard:</strong> ${err.message}
      </div>
    `;
  }
}

function kpiCard(title, value, subtitle, icon, color) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    teal: "bg-teal-50 text-teal-700"
  };
  return `
    <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start justify-between">
      <div>
        <div class="text-xs font-medium text-slate-500">${title}</div>
        <div class="text-3xl font-bold text-slate-800 mt-1">${value}</div>
        <div class="text-xs text-slate-400 mt-1.5">${subtitle}</div>
      </div>
      <div class="w-10 h-10 rounded-lg ${colorMap[color] || colorMap.blue} flex items-center justify-center text-lg">
        <i class="fa-solid ${icon}"></i>
      </div>
    </div>
  `;
}

function renderModulePlaceholder(tabId, user) {
  document.getElementById("pageTitle").textContent = `Modul: ${tabId.toUpperCase()}`;
  document.getElementById("pageSubtitle").textContent = "Siap dibangun pada tahap frontend berikutnya";
  document.getElementById("mainContentArea").innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
      <div class="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto text-xl">
        <i class="fa-solid fa-layer-group"></i>
      </div>
      <h3 class="text-base font-bold text-slate-800">Modul "${tabId}" Terdaftar untuk Role ${user.role}</h3>
      <p class="text-xs text-slate-500 max-w-md mx-auto">
        Fondasi autentikasi dan API client sudah terhubung. Kita akan melengkapi tampilan form & tabel interaktif modul ini pada langkah berikutnya.
      </p>
    </div>
  `;
}
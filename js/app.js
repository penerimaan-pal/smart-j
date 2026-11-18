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

/**
 * Helper pindah menu dari tombol jalan pintas di Dashboard sekaligus update highlight sidebar
 */
function goToModule(tabId) {
  const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (navBtn) {
    navBtn.click();
  } else if (typeof navigateToTab === "function") {
    navigateToTab(tabId);
  }
}

/**
 * DASHBOARD DINAMIS BERBASIS ROLE (ADMIN, VENDOR, RECEIVING, INSPECTOR)
 */
async function loadDashboardSummaryView(user) {
  const roleHeaderMap = {
    ADMIN: ["Dashboard Monitoring Eksekutif", "Ringkasan operasional penerimaan, pemeriksaan QC, dan BA Closing seluruh vendor"],
    VENDOR: ["Dashboard Portal Vendor", "Pantau status pengiriman, tindak lanjut revisi dokumen/NG, dan unduh BA Closing"],
    RECEIVING: ["Dashboard Operasional Receiving", "Antrian verifikasi dokumen pra-kirim, penerbitan MRR, dan upload BA Closing"],
    INSPECTOR: ["Dashboard Pemeriksaan QC", "Daftar antrian inspeksi material baru dan jadwal re-inspection"]
  };
  const [title, sub] = roleHeaderMap[user.role] || roleHeaderMap.ADMIN;
  document.getElementById("pageTitle").textContent = title;
  document.getElementById("pageSubtitle").textContent = sub;

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Menyiapkan ringkasan kerja ${user.role}...</span>
    </div>
  `;

  try {
    const [sumRes, delRes, mrrRes, clsRes] = await Promise.allSettled([
      SmartJApi.post("getDashboardSummary", {}),
      SmartJApi.post("getDeliveryList", {}),
      SmartJApi.post("getMRRList", {}),
      SmartJApi.post("getClosingList", {})
    ]);

    const summary = (sumRes.status === "fulfilled" && sumRes.value.success) ? (sumRes.value.summary || {}) : {};
    const deliveries = (delRes.status === "fulfilled" && delRes.value.success) ? (delRes.value.deliveries || []) : [];
    const mrrList = (mrrRes.status === "fulfilled" && mrrRes.value.success) ? (mrrRes.value.mrrList || []) : [];
    const closings = (clsRes.status === "fulfilled" && clsRes.value.success) ? (clsRes.value.closings || []) : [];

    // Hitung metrik real-time dari data transaksi
    const delSubmitted = deliveries.filter(d => String(d.STATUS).toUpperCase() === "SUBMITTED");
    const delRevision = deliveries.filter(d => String(d.STATUS).toUpperCase() === "REVISION_REQUIRED");
    const delVerified = deliveries.filter(d => String(d.STATUS).toUpperCase() === "DOCUMENT_VERIFIED");

    const mrrUnassigned = mrrList.filter(m => !m.INSPECTOR_USER_ID && String(m.LATEST_INSPECTION_STATUS).toUpperCase() !== "CLOSED");
    const mrrPendingQC = mrrList.filter(m => ["PENDING", "READY_FOR_REINSPECTION"].includes(String(m.LATEST_INSPECTION_STATUS || "PENDING").toUpperCase()));
    const mrrNG = mrrList.filter(m => String(m.LATEST_INSPECTION_STATUS).toUpperCase() === "WAITING_VENDOR_CORRECTION");
    const mrrOK = mrrList.filter(m => String(m.LATEST_INSPECTION_RESULT).toUpperCase() === "OK");

    const closingOpen = closings.filter(c => String(c.STATUS_CLOSING).toUpperCase() !== "COMPLETED");
    const closingCompleted = closings.filter(c => String(c.STATUS_CLOSING).toUpperCase() === "COMPLETED");

    // Helper render kartu KPI
    const kpiCard = (label, value, hint, icon, colorClass, targetTab) => `
      <div onclick="goToModule('${targetTab}')"
        class="cursor-pointer bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-400 hover:shadow transition">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">${label}</span>
          <div class="w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
        </div>
        <div class="mt-2 text-2xl font-extrabold text-slate-800">${Number(value || 0).toLocaleString("id-ID")}</div>
        <div class="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
          <span>${hint}</span>
          <span class="text-blue-700 font-semibold">Buka &rarr;</span>
        </div>
      </div>
    `;

    // =====================================================================
    // 1. TAMPILAN KHUSUS VENDOR
    // =====================================================================
    if (user.role === "VENDOR") {
      const actionNeeded = [
        ...delRevision.map(d => ({
          type: "REVISI DOKUMEN",
          badge: "bg-amber-100 text-amber-800",
          ref: `${d.DELIVERY_ID} (${d.PO_NUMBER})`,
          info: `Rencana tiba ${fmtDate(d.PLANNED_ARRIVAL_DATE)} — Dokumen dikembalikan Receiving`,
          tab: "deliveries",
          btn: "Revisi Sekarang"
        })),
        ...mrrNG.map(m => ({
          type: "TEMUAN QC (NG)",
          badge: "bg-red-100 text-red-800",
          ref: `${m.MRR_NUMBER} (${m.PO_NUMBER})`,
          info: `Round ${m.LATEST_INSPECTION_ROUND || 1} — Wajib upload bukti perbaikan`,
          tab: "inspection",
          btn: "Upload Perbaikan"
        }))
      ];

      container.innerHTML = `
        <div class="bg-gradient-to-r from-blue-900 to-slate-800 rounded-xl p-5 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="text-xs text-blue-200 uppercase tracking-wider font-semibold">Portal Rekanan Vendor</div>
            <h3 class="text-lg font-bold mt-0.5">Selamat Datang, ${user.fullName}</h3>
            <p class="text-xs text-slate-300 mt-1">Kelola PO, ajukan pengiriman beserta dokumen wajib, dan pantau hasil QC secara real-time.</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            <button onclick="goToModule('vendor_po')" class="px-3.5 py-2 rounded-lg bg-white text-blue-900 font-bold hover:bg-blue-50">
              <i class="fa-solid fa-plus mr-1"></i>Input PO / Item
            </button>
            <button onclick="goToModule('deliveries')" class="px-3.5 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500">
              <i class="fa-solid fa-truck-fast mr-1"></i>Ajukan Pengiriman
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${kpiCard("PO / Kontrak Saya", summary.totalPO || summary.activePO || 0, "Total PO terdaftar", "fa-file-contract", "bg-blue-50 text-blue-700", "vendor_po")}
          ${kpiCard("Perlu Revisi Dokumen", delRevision.length, "Pengiriman dikembalikan", "fa-file-circle-exclamation", "bg-amber-50 text-amber-700", "deliveries")}
          ${kpiCard("Temuan QC (NG)", mrrNG.length, "Menunggu perbaikan Anda", "fa-triangle-exclamation", "bg-red-50 text-red-700", "inspection")}
          ${kpiCard("BA Closing Terbit", closingCompleted.length, "Siap diunduh (PDF)", "fa-file-pdf", "bg-emerald-50 text-emerald-700", "closing")}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-800">Tindak Lanjut Mendesak untuk Vendor (${actionNeeded.length})</h3>
            <span class="text-[11px] text-slate-500">Item yang membutuhkan revisi dokumen atau perbaikan material</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <th class="py-3 px-4">Kategori</th>
                  <th class="py-3 px-4">Referensi</th>
                  <th class="py-3 px-4">Keterangan</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${actionNeeded.length === 0 ? `
                  <tr><td colspan="4" class="py-6 text-center text-emerald-700 font-medium">
                    <i class="fa-solid fa-circle-check mr-1"></i>Tidak ada revisi dokumen maupun temuan NG yang tertunda.
                  </td></tr>
                ` : actionNeeded.map(item => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-4"><span class="px-2 py-0.5 rounded font-bold text-[11px] ${item.badge}">${item.type}</span></td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-800">${item.ref}</td>
                    <td class="py-3 px-4 text-slate-600">${item.info}</td>
                    <td class="py-3 px-4 text-right">
                      <button onclick="goToModule('${item.tab}')" class="px-3 py-1 rounded bg-blue-800 text-white font-semibold hover:bg-blue-900">
                        ${item.btn}
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // =====================================================================
    // 2. TAMPILAN KHUSUS RECEIVING
    // =====================================================================
    if (user.role === "RECEIVING") {
      const recQueue = [
        ...delSubmitted.map(d => ({
          stage: "1. VERIFIKASI DOKUMEN",
          badge: "bg-blue-100 text-blue-800",
          ref: `${d.DELIVERY_ID} • ${d.PO_NUMBER}`,
          vendor: d.VENDOR_NAME,
          detail: `Rencana tiba: ${fmtDate(d.PLANNED_ARRIVAL_DATE)} (${d.VEHICLE_PLATE})`,
          tab: "deliveries"
        })),
        ...delVerified.map(d => ({
          stage: "2. TERBITKAN MRR",
          badge: "bg-indigo-100 text-indigo-800",
          ref: `${d.DELIVERY_ID} • ${d.PO_NUMBER}`,
          vendor: d.VENDOR_NAME,
          detail: `Dokumen lengkap, siap konfirmasi kedatangan fisik`,
          tab: "receiving_mrr"
        })),
        ...mrrUnassigned.map(m => ({
          stage: "3. ASSIGN INSPECTOR",
          badge: "bg-amber-100 text-amber-800",
          ref: `${m.MRR_NUMBER} • ${m.PO_NUMBER}`,
          vendor: m.VENDOR_NAME,
          detail: `MRR terbit ${fmtDate(m.MRR_ISSUED_DATETIME)}, belum ada Inspector`,
          tab: "inspection"
        })),
        ...closingOpen.map(c => ({
          stage: "4. UPLOAD BA CLOSING",
          badge: "bg-emerald-100 text-emerald-800",
          ref: `${c.MRR_NUMBER} • ${c.PO_NUMBER}`,
          vendor: c.VENDOR_NAME,
          detail: `Material lulus QC (OK), siap unggah PDF BA Closing`,
          tab: "closing"
        }))
      ];

      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${kpiCard("Dokumen Baru Masuk", delSubmitted.length, "Menunggu verifikasi", "fa-file-circle-check", "bg-blue-50 text-blue-700", "deliveries")}
          ${kpiCard("Siap Terbit MRR", delVerified.length, "Dokumen sudah OK", "fa-file-invoice", "bg-indigo-50 text-indigo-700", "receiving_mrr")}
          ${kpiCard("Belum Assign Inspector", mrrUnassigned.length, "MRR menunggu jadwal QC", "fa-user-check", "bg-amber-50 text-amber-700", "inspection")}
          ${kpiCard("Antrian BA Closing", closingOpen.length, "Siap upload PDF final", "fa-file-arrow-up", "bg-emerald-50 text-emerald-700", "closing")}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-800">Antrian Tugas Receiving Hari Ini (${recQueue.length})</h3>
            <span class="text-[11px] text-slate-500">Urutan alur: Verifikasi Dokumen &rarr; Terbit MRR &rarr; Assign Inspector &rarr; BA Closing</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <th class="py-3 px-4">Tahap Tugas</th>
                  <th class="py-3 px-4">Referensi</th>
                  <th class="py-3 px-4">Vendor</th>
                  <th class="py-3 px-4">Keterangan</th>
                  <th class="py-3 px-4 text-right">Proses</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${recQueue.length === 0 ? `
                  <tr><td colspan="5" class="py-6 text-center text-slate-400">Semua antrian Receiving sudah diproses.</td></tr>
                ` : recQueue.map(q => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-4"><span class="px-2 py-0.5 rounded font-bold text-[11px] ${q.badge}">${q.stage}</span></td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-800">${q.ref}</td>
                    <td class="py-3 px-4 font-medium">${q.vendor}</td>
                    <td class="py-3 px-4 text-slate-600">${q.detail}</td>
                    <td class="py-3 px-4 text-right">
                      <button onclick="goToModule('${q.tab}')" class="px-3 py-1 rounded bg-blue-800 text-white font-semibold hover:bg-blue-900">
                        Buka Modul
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // =====================================================================
    // 3. TAMPILAN KHUSUS INSPECTOR (QC)
    // =====================================================================
    if (user.role === "INSPECTOR") {
      const myQueue = mrrList.filter(m => String(m.LATEST_INSPECTION_STATUS || "PENDING").toUpperCase() !== "CLOSED");

      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${kpiCard("Siap Diperiksa", mrrPendingQC.length, "Antrian awal & re-inspeksi", "fa-magnifying-glass-chart", "bg-blue-50 text-blue-700", "inspection")}
          ${kpiCard("Menunggu Perbaikan Vendor", mrrNG.length, "Status NG terbuka", "fa-clock-rotate-left", "bg-red-50 text-red-700", "inspection")}
          ${kpiCard("Material Lolos (OK)", mrrOK.length, "Total inspeksi selesai", "fa-circle-check", "bg-emerald-50 text-emerald-700", "inspection")}
          ${kpiCard("Total MRR Terbit", mrrList.length, "Seluruh kedatangan material", "fa-file-invoice", "bg-slate-100 text-slate-700", "receiving_mrr")}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-800">Daftar Antrian Pemeriksaan QC Aktif (${myQueue.length})</h3>
            <button onclick="goToModule('inspection')" class="px-3 py-1.5 rounded-lg bg-blue-800 text-white text-xs font-semibold hover:bg-blue-900">
              Buka Halaman Pemeriksaan &rarr;
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <th class="py-3 px-4">Nomor MRR</th>
                  <th class="py-3 px-4">No. PO & Vendor</th>
                  <th class="py-3 px-4">Putaran</th>
                  <th class="py-3 px-4">Status QC</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${myQueue.length === 0 ? `
                  <tr><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada antrian pemeriksaan material saat ini.</td></tr>
                ` : myQueue.map(m => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-4 font-mono font-bold text-emerald-800">${m.MRR_NUMBER}</td>
                    <td class="py-3 px-4">
                      <div class="font-bold text-blue-900">${m.PO_NUMBER}</div>
                      <div class="text-[11px] text-slate-600">${m.VENDOR_NAME}</div>
                    </td>
                    <td class="py-3 px-4 font-semibold">Round ${m.LATEST_INSPECTION_ROUND || 0}</td>
                    <td class="py-3 px-4 font-semibold text-slate-700">${m.LATEST_INSPECTION_STATUS || "PENDING"}</td>
                    <td class="py-3 px-4 text-right">
                      <button onclick="goToModule('inspection')" class="px-3 py-1 rounded bg-blue-700 text-white font-semibold hover:bg-blue-800">
                        Periksa
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // =====================================================================
    // 4. TAMPILAN KHUSUS ADMIN (EKSEKUTIF & END-TO-END)
    // =====================================================================
    const totalMrrCount = mrrList.length;
    const qcPassPct = totalMrrCount > 0 ? Math.round((mrrOK.length / totalMrrCount) * 100) : 0;
    const closingPct = closings.length > 0 ? Math.round((closingCompleted.length / closings.length) * 100) : 0;

    container.innerHTML = `
      <!-- Quick Actions Bar Admin -->
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div class="text-xs">
          <span class="font-bold text-slate-800">Kontrol Administrator:</span>
          <span class="text-slate-500 ml-1">Kelola master data, hak akses user, dan pantau bottleneck siklus material.</span>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          <button onclick="goToModule('users_vendors')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold">
            <i class="fa-solid fa-users-gear mr-1"></i>User & Vendor
          </button>
          <button onclick="goToModule('master_data')" class="px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">
            <i class="fa-solid fa-diagram-project mr-1"></i>Project & Syarat Dokumen
          </button>
        </div>
      </div>

      <!-- 4 KPI Utama Lintas Siklus -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpiCard("Total PO Aktif", summary.totalPO || summary.activePO || 0, "Kontrak pengadaan berjalan", "fa-file-contract", "bg-blue-50 text-blue-700", "master_data")}
        ${kpiCard("Pengiriman Pra-MRR", delSubmitted.length + delVerified.length, `${delSubmitted.length} cek dok • ${delVerified.length} siap MRR`, "fa-truck-front", "bg-indigo-50 text-indigo-700", "deliveries")}
        ${kpiCard("MRR & Antrian QC", mrrList.length, `${mrrPendingQC.length} antrian • ${mrrNG.length} temuan NG`, "fa-microscope", "bg-amber-50 text-amber-700", "inspection")}
        ${kpiCard("BA Closing Selesai", closingCompleted.length, `Dari ${closings.length} tiket closing`, "fa-file-circle-check", "bg-emerald-50 text-emerald-700", "closing")}
      </div>

      <!-- Progress Bar Kesehatan Siklus Material -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div class="flex justify-between text-xs font-bold">
            <span class="text-slate-700">Tingkat Kelulusan Inspeksi QC (OK)</span>
            <span class="text-emerald-700">${mrrOK.length} / ${totalMrrCount} MRR (${qcPassPct}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-600 rounded-full" style="width:${qcPassPct}%"></div>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div class="flex justify-between text-xs font-bold">
            <span class="text-slate-700">Penyelesaian Dokumen BA Closing</span>
            <span class="text-blue-800">${closingCompleted.length} / ${closings.length} Tiket (${closingPct}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-blue-700 rounded-full" style="width:${closingPct}%"></div>
          </div>
        </div>
      </div>

      <!-- Tabel Monitoring MRR Terbaru -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-800">Monitoring Status MRR, QC & Closing Terbaru</h3>
          <button onclick="goToModule('receiving_mrr')" class="text-xs font-semibold text-blue-700 hover:underline">Lihat Semua MRR &rarr;</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Nomor MRR</th>
                <th class="py-3 px-4">No. PO & Vendor</th>
                <th class="py-3 px-4">Tgl Terbit</th>
                <th class="py-3 px-4">Status QC</th>
                <th class="py-3 px-4">Status Closing</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${mrrList.length === 0 ? `
                <tr><td colspan="5" class="py-6 text-center text-slate-400">Belum ada transaksi MRR tercatat.</td></tr>
              ` : mrrList.slice(0, 8).map(m => `
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-mono font-bold text-emerald-800">${m.MRR_NUMBER}</td>
                  <td class="py-3 px-4">
                    <div class="font-bold text-blue-900">${m.PO_NUMBER}</div>
                    <div class="text-[11px] text-slate-600">${m.VENDOR_NAME}</div>
                  </td>
                  <td class="py-3 px-4 text-slate-600">${fmtDate(m.MRR_ISSUED_DATETIME)}</td>
                  <td class="py-3 px-4 font-semibold">${m.LATEST_INSPECTION_RESULT} (${m.LATEST_INSPECTION_STATUS})</td>
                  <td class="py-3 px-4 font-semibold text-slate-700">${m.CLOSING_STATUS}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
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
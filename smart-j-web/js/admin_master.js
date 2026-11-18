/**
 * SMART-J FRONTEND - MODUL MASTER DATA (FULL CRUD: CREATE, READ, UPDATE, DELETE)
 * @author Allif Cendikiawan — Quality Engineer
 */

let lastCreatedCredential = null;
let cachedUsersList = [];
let cachedVendorsList = [];
let cachedMasterData = null;

function fmtNumber(num) {
  return Number(num || 0).toLocaleString("id-ID");
}

function fmtDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function toInputDate(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function showInlineBanner(containerId, message, type = "success") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = type === "success"
    ? "p-3 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 mb-4"
    : "p-3 rounded-lg text-xs font-medium bg-red-50 text-red-800 border border-red-200 mb-4";
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 7000);
}

function generateRandomPassword(length = 10) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;

  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)]
  ];

  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join("");
}

async function copyTextToClipboard(text, btnEl = null, successLabel = "Tersalin!") {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    if (btnEl) {
      const originalHtml = btnEl.innerHTML;
      btnEl.innerHTML = `<i class="fa-solid fa-check text-emerald-600"></i> <span>${successLabel}</span>`;
      setTimeout(() => { btnEl.innerHTML = originalHtml; }, 2000);
    }
  } catch (err) {
    alert("Gagal menyalin otomatis. Silakan blok dan copy manual: " + text);
  }
}

function dismissCredentialBox() {
  lastCreatedCredential = null;
  const box = document.getElementById("newUserCredentialBox");
  if (box) box.remove();
}

function renderCredentialCardHtml() {
  if (!lastCreatedCredential) return "";
  const c = lastCreatedCredential;
  const portalUrl = window.location.origin + window.location.pathname;
  const waTemplate =
    `Halo ${c.fullName},\n` +
    `Berikut akses akun SMART-J (${c.role}) Anda:\n` +
    `• Link Portal: ${portalUrl}\n` +
    `• Username: ${c.username}\n` +
    `• Password: ${c.password}\n` +
    `Silakan login dan simpan informasi akun ini.`;

  return `
    <div id="newUserCredentialBox" class="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 shadow-sm mb-6 text-xs">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <i class="fa-solid fa-key text-emerald-700"></i>
            <span>${c.isReset ? "Password Baru Berhasil Direset!" : "Akun Pengguna Baru Berhasil Dibuat!"}</span>
          </div>
          <p class="text-emerald-800">
            Segera salin dan berikan kredensial di bawah ini kepada <strong>${c.fullName}</strong> (${c.role}):
          </p>
        </div>
        <button type="button" onclick="dismissCredentialBox()" class="text-emerald-700 hover:text-emerald-950 font-semibold px-2 py-1">
          <i class="fa-solid fa-xmark"></i> Tutup
        </button>
      </div>

      <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-emerald-200">
        <div>
          <span class="text-slate-500 block text-[11px]">Username</span>
          <span class="font-mono font-bold text-sm text-slate-900 select-all">${c.username}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[11px]">Password ${c.isReset ? "Baru" : "Awal"}</span>
          <span class="font-mono font-bold text-sm text-blue-800 select-all">${c.password}</span>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" id="btnCopyOnlyPwd"
          class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-900 font-semibold flex items-center gap-1.5 transition">
          <i class="fa-regular fa-copy"></i>
          <span>Copy Password Saja</span>
        </button>
        <button type="button" id="btnCopyFullWa"
          class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1.5 transition">
          <i class="fa-brands fa-whatsapp"></i>
          <span>Copy Format Pesan Login (Siap Kirim)</span>
        </button>
      </div>
      <textarea id="hiddenWaTemplate" class="hidden">${waTemplate}</textarea>
    </div>
  `;
}

// =========================================================================
// UNIVERSAL MODAL EDIT MASTER DATA
// =========================================================================
function renderUniversalEditModalHtml() {
  return `
    <div id="universalEditModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 id="editModalTitle" class="text-sm font-bold text-slate-800">Edit Data</h3>
          <button type="button" onclick="closeUniversalEditModal()" class="text-slate-400 hover:text-slate-700 text-lg">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form id="universalEditForm" class="p-5 text-xs space-y-3"></form>
      </div>
    </div>
  `;
}

function closeUniversalEditModal() {
  const modal = document.getElementById("universalEditModal");
  if (modal) modal.classList.add("hidden");
}

function openEditModal(entityType, id) {
  const modal = document.getElementById("universalEditModal");
  const titleEl = document.getElementById("editModalTitle");
  const formEl = document.getElementById("universalEditForm");
  if (!modal || !formEl) return;

  let actionName = "";
  let reloadContext = "USERS_VENDORS"; // or "MASTER_ADMIN" or "MASTER_VENDOR"

  if (entityType === "USER") {
    const u = cachedUsersList.find(x => String(x.USER_ID) === String(id));
    if (!u) return;
    actionName = "adminUpdateUser";
    reloadContext = "USERS_VENDORS";
    titleEl.textContent = `Edit Akun User: ${u.USERNAME}`;
    formEl.innerHTML = `
      <input type="hidden" name="userId" value="${u.USER_ID}" />
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Nama Lengkap / PIC *</label>
        <input type="text" name="fullName" required value="${u.FULL_NAME || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Role Hak Akses *</label>
        <select name="role" id="editUserRoleSel" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
          <option value="VENDOR" ${u.ROLE === "VENDOR" ? "selected" : ""}>VENDOR</option>
          <option value="RECEIVING" ${u.ROLE === "RECEIVING" ? "selected" : ""}>RECEIVING</option>
          <option value="INSPECTOR" ${u.ROLE === "INSPECTOR" ? "selected" : ""}>INSPECTOR</option>
          <option value="ADMIN" ${u.ROLE === "ADMIN" ? "selected" : ""}>ADMIN</option>
        </select>
      </div>
      <div id="editUserVendorWrap" style="display:${u.ROLE === "VENDOR" ? "block" : "none"}">
        <label class="block font-semibold text-slate-700 mb-1">Perusahaan Vendor *</label>
        <select name="vendorId" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
          <option value="">-- Pilih Perusahaan Vendor --</option>
          ${cachedVendorsList.map(v => `<option value="${v.VENDOR_ID}" ${String(v.VENDOR_ID) === String(u.VENDOR_ID) ? "selected" : ""}>${v.VENDOR_CODE} - ${v.VENDOR_NAME}</option>`).join("")}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Email</label>
          <input type="email" name="email" value="${u.EMAIL || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">No. HP</label>
          <input type="text" name="phone" value="${u.PHONE || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeUniversalEditModal()" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">Batal</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">Simpan Perubahan</button>
      </div>
    `;
    setTimeout(() => {
      const sel = document.getElementById("editUserRoleSel");
      const wrap = document.getElementById("editUserVendorWrap");
      if (sel && wrap) {
        sel.addEventListener("change", () => {
          wrap.style.display = sel.value === "VENDOR" ? "block" : "none";
        });
      }
    }, 0);

  } else if (entityType === "VENDOR") {
    const v = cachedVendorsList.find(x => String(x.VENDOR_ID) === String(id));
    if (!v) return;
    actionName = "adminUpdateVendor";
    reloadContext = "USERS_VENDORS";
    titleEl.textContent = `Edit Perusahaan Vendor: ${v.VENDOR_CODE}`;
    formEl.innerHTML = `
      <input type="hidden" name="vendorId" value="${v.VENDOR_ID}" />
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Kode Vendor *</label>
          <input type="text" name="vendorCode" required value="${v.VENDOR_CODE || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nama Perusahaan *</label>
          <input type="text" name="vendorName" required value="${v.VENDOR_NAME || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nama PIC</label>
          <input type="text" name="picName" value="${v.PIC_NAME || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">No. Telepon / WA</label>
          <input type="text" name="phone" value="${v.PHONE || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Email</label>
          <input type="email" name="email" value="${v.EMAIL || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">NPWP / Tax ID</label>
          <input type="text" name="taxId" value="${v.TAX_ID || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
        <input type="text" name="address" value="${v.ADDRESS || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeUniversalEditModal()" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">Batal</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">Simpan Perubahan</button>
      </div>
    `;

  } else if (entityType === "PROJECT") {
    const p = (cachedMasterData.projects || []).find(x => String(x.PROJECT_ID) === String(id));
    if (!p) return;
    actionName = "adminUpdateProject";
    reloadContext = "MASTER_ADMIN";
    titleEl.textContent = `Edit Project: ${p.PROJECT_CODE}`;
    formEl.innerHTML = `
      <input type="hidden" name="projectId" value="${p.PROJECT_ID}" />
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Kode Project *</label>
          <input type="text" name="projectCode" required value="${p.PROJECT_CODE || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nama Project *</label>
          <input type="text" name="projectName" required value="${p.PROJECT_NAME || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Tgl Mulai</label>
          <input type="date" name="startDate" value="${toInputDate(p.START_DATE)}" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Tgl Selesai</label>
          <input type="date" name="endDate" value="${toInputDate(p.END_DATE)}" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Status</label>
          <select name="status" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="ACTIVE" ${p.STATUS === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
            <option value="COMPLETED" ${p.STATUS === "COMPLETED" ? "selected" : ""}>COMPLETED</option>
            <option value="HOLD" ${p.STATUS === "HOLD" ? "selected" : ""}>HOLD</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Deskripsi</label>
        <input type="text" name="description" value="${p.DESCRIPTION || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeUniversalEditModal()" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">Batal</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">Simpan Perubahan</button>
      </div>
    `;

  } else if (entityType === "PO") {
    const po = (cachedMasterData.poContracts || []).find(x => String(x.PO_ID) === String(id));
    if (!po) return;
    const isAdmin = SmartJApi.getUser().role === "ADMIN";
    actionName = "adminUpdatePO";
    reloadContext = isAdmin ? "MASTER_ADMIN" : "MASTER_VENDOR";
    titleEl.textContent = `Edit PO / Kontrak: ${po.PO_NUMBER}`;
    formEl.innerHTML = `
      <input type="hidden" name="poId" value="${po.PO_ID}" />
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Project *</label>
        <select name="projectId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
          ${(cachedMasterData.projects || []).map(p => `<option value="${p.PROJECT_ID}" ${String(p.PROJECT_ID) === String(po.PROJECT_ID) ? "selected" : ""}>${p.PROJECT_CODE} - ${p.PROJECT_NAME}</option>`).join("")}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nomor PO *</label>
          <input type="text" name="poNumber" required value="${po.PO_NUMBER || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nomor Kontrak</label>
          <input type="text" name="contractNumber" value="${po.CONTRACT_NUMBER || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Tanggal PO</label>
          <input type="date" name="poDate" value="${toInputDate(po.PO_DATE)}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        ${isAdmin ? `
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status PO</label>
            <select name="status" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="ACTIVE" ${po.STATUS === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
              <option value="CLOSED" ${po.STATUS === "CLOSED" ? "selected" : ""}>CLOSED</option>
              <option value="CANCELLED" ${po.STATUS === "CANCELLED" ? "selected" : ""}>CANCELLED</option>
            </select>
          </div>
        ` : ""}
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Deskripsi Pengadaan</label>
        <input type="text" name="description" value="${po.DESCRIPTION || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeUniversalEditModal()" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">Batal</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">Simpan Perubahan</button>
      </div>
    `;

  } else if (entityType === "PO_ITEM") {
    const it = (cachedMasterData.poItems || []).find(x => String(x.PO_ITEM_ID) === String(id));
    if (!it) return;
    const isAdmin = SmartJApi.getUser().role === "ADMIN";
    actionName = "adminUpdatePOItem";
    reloadContext = isAdmin ? "MASTER_ADMIN" : "MASTER_VENDOR";
    titleEl.textContent = `Edit Item Material: ${it.MATERIAL_NAME}`;
    formEl.innerHTML = `
      <input type="hidden" name="poItemId" value="${it.PO_ITEM_ID}" />
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Kode Material</label>
          <input type="text" name="itemCode" value="${it.ITEM_CODE || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Nama Material *</label>
          <input type="text" name="materialName" required value="${it.MATERIAL_NAME || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Spesifikasi Material</label>
        <input type="text" name="specification" value="${it.SPECIFICATION || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Total Kuota Qty PO *</label>
          <input type="number" step="any" min="0.01" name="qtyPo" required value="${it.QTY_PO}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Satuan (UOM) *</label>
          <input type="text" name="uom" required value="${it.UOM || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeUniversalEditModal()" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">Batal</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">Simpan Perubahan</button>
      </div>
    `;

  } else if (entityType === "DOC_REQ") {
    const doc = (cachedMasterData.docRequirements || []).find(x => String(x.REQUIREMENT_ID) === String(id));
    if (!doc) return;
    const isMand = String(doc.IS_MANDATORY).toUpperCase() === "TRUE";
    actionName = "adminUpdateDocRequirement";
    reloadContext = "MASTER_ADMIN";
    titleEl.textContent = `Edit Syarat Dokumen: ${doc.DOC_CODE}`;
    formEl.innerHTML = `
      <input type="hidden" name="requirementId" value="${doc.REQUIREMENT_ID}" />
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Kode Dokumen *</label>
          <input type="text" name="docCode" required value="${doc.DOC_CODE || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
        </div>
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Sifat Dokumen</label>
          <select name="isMandatory" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
            <option value="TRUE" ${isMand ? "selected" : ""}>WAJIB</option>
            <option value="FALSE" ${!isMand ? "selected" : ""}>OPSIONAL</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Nama Dokumen *</label>
        <input type="text" name="documentName" required value="${doc.DOCUMENT_NAME || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Format Diizinkan</label>
        <input type="text" name="allowedFormats" value="${doc.ALLOWED_FORMATS || "pdf,jpg,jpeg,png"}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div>
        <label class="block font-semibold text-slate-700 mb-1">Keterangan</label>
        <input type="text" name="description" value="${doc.DESCRIPTION || ""}" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeUniversalEditModal()" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold">Batal</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">Simpan Perubahan</button>
      </div>
    `;
  }

  modal.classList.remove("hidden");

  formEl.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = formEl.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Menyimpan...";

    try {
      const payload = Object.fromEntries(new FormData(formEl).entries());
      const res = await SmartJApi.post(actionName, payload);
      if (!res.success) throw new Error(res.message);

      closeUniversalEditModal();
      if (reloadContext === "USERS_VENDORS") {
        await loadUsersVendorsView();
        showInlineBanner("uvAlertBanner", res.message, "success");
      } else {
        const isV = reloadContext === "MASTER_VENDOR";
        await loadMasterDataView(isV);
        showInlineBanner("mdAlertBanner", res.message, "success");
      }
    } catch (err) {
      alert("Gagal memperbarui data: " + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Simpan Perubahan";
    }
  };
}

async function handleDeleteEntity(entityType, id, labelText) {
  if (!confirm(`Yakin ingin menghapus "${labelText}"?\nData yang dihapus tidak dapat dikembalikan.`)) return;

  const actionMap = {
    USER: { action: "adminDeleteUser", key: "userId", reload: "USERS_VENDORS" },
    VENDOR: { action: "adminDeleteVendor", key: "vendorId", reload: "USERS_VENDORS" },
    PROJECT: { action: "adminDeleteProject", key: "projectId", reload: "MASTER_ADMIN" },
    PO: { action: "adminDeletePO", key: "poId", reload: "MASTER_AUTO" },
    PO_ITEM: { action: "adminDeletePOItem", key: "poItemId", reload: "MASTER_AUTO" },
    DOC_REQ: { action: "adminDeleteDocRequirement", key: "requirementId", reload: "MASTER_ADMIN" }
  };

  const cfg = actionMap[entityType];
  if (!cfg) return;

  try {
    const res = await SmartJApi.post(cfg.action, { [cfg.key]: id });
    if (!res.success) throw new Error(res.message);

    if (cfg.reload === "USERS_VENDORS") {
      await loadUsersVendorsView();
      showInlineBanner("uvAlertBanner", res.message, "success");
    } else {
      const isVendor = SmartJApi.getUser().role === "VENDOR";
      await loadMasterDataView(isVendor);
      showInlineBanner("mdAlertBanner", res.message, "success");
    }
  } catch (err) {
    const bannerId = cfg.reload === "USERS_VENDORS" ? "uvAlertBanner" : "mdAlertBanner";
    showInlineBanner(bannerId, err.message, "error");
  }
}

// =========================================================================
// VIEW A: MANAJEMEN USER & VENDOR (KHUSUS ADMIN)
// =========================================================================
async function loadUsersVendorsView() {
  document.getElementById("pageTitle").textContent = "Manajemen User & Perusahaan Vendor";
  document.getElementById("pageSubtitle").textContent = "Kelola daftar vendor rekanan serta akun akses ADMIN, VENDOR, RECEIVING, dan INSPECTOR";

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat data user dan vendor...</span>
    </div>
  `;

  try {
    const [usersRes, vendorsRes] = await Promise.all([
      SmartJApi.post("adminListUsers", {}),
      SmartJApi.post("adminListVendors", {})
    ]);

    if (!usersRes.success) throw new Error(usersRes.message);
    if (!vendorsRes.success) throw new Error(vendorsRes.message);

    cachedUsersList = usersRes.users || [];
    cachedVendorsList = vendorsRes.vendors || [];

    const vendorMap = {};
    cachedVendorsList.forEach(v => { vendorMap[v.VENDOR_ID] = v.VENDOR_NAME; });
    const initialAutoPwd = generateRandomPassword(10);

    container.innerHTML = `
      <div id="uvAlertBanner" class="hidden"></div>
      ${renderCredentialCardHtml()}
      ${renderUniversalEditModalHtml()}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Form 1: Tambah Perusahaan Vendor -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i class="fa-solid fa-building text-blue-700"></i>
            <span>1. Daftarkan Perusahaan Vendor Baru</span>
          </h3>
          <form id="formCreateVendor" class="space-y-3 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Kode Vendor *</label>
                <input type="text" name="vendorCode" required placeholder="Contoh: VND-BN02"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nama Perusahaan *</label>
                <input type="text" name="vendorName" required placeholder="PT Contoh Baja Utama"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nama PIC Vendor</label>
                <input type="text" name="picName" placeholder="Nama penanggung jawab"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">No. Telepon / WA</label>
                <input type="text" name="phone" placeholder="0812..."
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" name="email" placeholder="pic@vendor.co.id"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">NPWP / Tax ID</label>
                <input type="text" name="taxId" placeholder="01.234.567..."
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
              <input type="text" name="address" placeholder="Alamat kantor/workshop vendor"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition">
              + Simpan Data Vendor
            </button>
          </form>
        </div>

        <!-- Form 2: Tambah Akun User Login -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i class="fa-solid fa-user-plus text-emerald-700"></i>
            <span>2. Buat Akun Login Pengguna</span>
          </h3>
          <form id="formCreateUser" autocomplete="off" class="space-y-3 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nama Lengkap / PIC *</label>
                <input type="text" id="inputNewUserFullName" name="fullName" required placeholder="Contoh: Budi Santoso"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Role Hak Akses *</label>
                <select name="role" id="selectNewUserRole" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="VENDOR">VENDOR (Portal Vendor)</option>
                  <option value="RECEIVING">RECEIVING (Penerimaan & MRR)</option>
                  <option value="INSPECTOR">INSPECTOR (Tim Pemeriksa QC)</option>
                  <option value="ADMIN">ADMIN (Super Admin)</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Username (4-30 karakter) *</label>
                <input type="text" id="inputNewUserUsername" name="username" required
                  pattern="[a-zA-Z0-9._-]{4,30}"
                  title="4-30 karakter: huruf, angka, titik (.), underscore (_), atau strip (-) tanpa spasi"
                  placeholder="budi.santoso"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Password Awal (Otomatis) *</label>
                <div class="flex gap-1.5">
                  <input type="text" id="inputNewUserPassword" name="password" required minlength="8"
                    value="${initialAutoPwd}"
                    class="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono font-bold text-blue-900 bg-slate-50" />
                  <button type="button" id="btnRegeneratePwd" title="Acak Password Baru"
                    class="px-2.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700">
                    <i class="fa-solid fa-shuffle"></i>
                  </button>
                  <button type="button" id="btnCopyFormPwd" title="Copy Password"
                    class="px-2.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>
            <div id="vendorSelectWrapper">
              <label class="block font-semibold text-slate-700 mb-1">Hubungkan ke Perusahaan Vendor *</label>
              <select name="vendorId" id="selectNewUserVendor" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Perusahaan Vendor --</option>
                ${cachedVendorsList.map(v => `<option value="${v.VENDOR_ID}">${v.VENDOR_CODE} - ${v.VENDOR_NAME}</option>`).join("")}
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" name="email" placeholder="email@domain.com"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">No. HP</label>
                <input type="text" name="phone" placeholder="0812..."
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <button type="submit" class="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition">
              + Buat Akun User
            </button>
          </form>
        </div>
      </div>

      <!-- TABEL DAFTAR USER -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800">Daftar Akun Pengguna Terdaftar (${cachedUsersList.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Username</th>
                <th class="py-3 px-4">Nama Lengkap</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">Perusahaan Vendor</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi Kontrol</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${cachedUsersList.map(u => {
                const isAct = String(u.IS_ACTIVE).toUpperCase() === "TRUE";
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-4 font-mono font-semibold text-slate-800">${u.USERNAME}</td>
                    <td class="py-3 px-4">${u.FULL_NAME}</td>
                    <td class="py-3 px-4">
                      <span class="px-2 py-0.5 rounded font-bold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                        ${u.ROLE}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-slate-600">${u.VENDOR_ID ? (vendorMap[u.VENDOR_ID] || u.VENDOR_ID) : "-"}</td>
                    <td class="py-3 px-4">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${isAct ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}">
                        ${isAct ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      <button onclick="openEditModal('USER', '${u.USER_ID}')" title="Edit User"
                        class="px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-medium">
                        <i class="fa-solid fa-pen"></i> Edit
                      </button>
                      <button onclick="handleToggleUser('${u.USER_ID}')"
                        class="px-2 py-1 rounded border text-[11px] font-medium ${isAct ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}">
                        ${isAct ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button data-uid="${u.USER_ID}" data-uname="${u.USERNAME}" data-fname="${u.FULL_NAME}" data-role="${u.ROLE}"
                        onclick="handleResetUserPwdFromBtn(this)"
                        class="px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-medium">
                        Reset Pass
                      </button>
                      <button onclick="handleDeleteEntity('USER', '${u.USER_ID}', '${u.USERNAME}')" title="Hapus User"
                        class="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-medium">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABEL DAFTAR VENDOR -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800">Daftar Perusahaan Vendor (${cachedVendorsList.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Kode</th>
                <th class="py-3 px-4">Nama Perusahaan</th>
                <th class="py-3 px-4">PIC & Kontak</th>
                <th class="py-3 px-4">Alamat</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${cachedVendorsList.length === 0 ? `<tr><td colspan="5" class="py-6 text-center text-slate-400">Belum ada data vendor.</td></tr>` : cachedVendorsList.map(v => `
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-mono font-bold text-blue-800">${v.VENDOR_CODE}</td>
                  <td class="py-3 px-4 font-semibold text-slate-800">${v.VENDOR_NAME}</td>
                  <td class="py-3 px-4 text-slate-600">${v.PIC_NAME || "-"} (${v.PHONE || "-"})</td>
                  <td class="py-3 px-4 text-slate-500">${v.ADDRESS || "-"}</td>
                  <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    <button onclick="openEditModal('VENDOR', '${v.VENDOR_ID}')"
                      class="px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-medium">
                      <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button onclick="handleDeleteEntity('VENDOR', '${v.VENDOR_ID}', '${v.VENDOR_NAME}')"
                      class="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-medium">
                      <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind tombol copy kartu kredensial
    const btnCopyOnlyPwd = document.getElementById("btnCopyOnlyPwd");
    if (btnCopyOnlyPwd && lastCreatedCredential) {
      btnCopyOnlyPwd.addEventListener("click", () => {
        copyTextToClipboard(lastCreatedCredential.password, btnCopyOnlyPwd, "Password Tersalin!");
      });
    }
    const btnCopyFullWa = document.getElementById("btnCopyFullWa");
    if (btnCopyFullWa) {
      btnCopyFullWa.addEventListener("click", () => {
        const msg = document.getElementById("hiddenWaTemplate").value;
        copyTextToClipboard(msg, btnCopyFullWa, "Pesan Login Tersalin!");
      });
    }

    // Bind Acak & Copy Password Form
    const pwdField = document.getElementById("inputNewUserPassword");
    document.getElementById("btnRegeneratePwd").addEventListener("click", () => {
      pwdField.value = generateRandomPassword(10);
    });
    document.getElementById("btnCopyFormPwd").addEventListener("click", (e) => {
      copyTextToClipboard(pwdField.value, e.currentTarget, "");
    });

    // Auto-suggest username dari Nama Lengkap
    const fullNameInput = document.getElementById("inputNewUserFullName");
    const usernameInput = document.getElementById("inputNewUserUsername");
    let usernameManual = false;
    usernameInput.addEventListener("input", () => { usernameManual = usernameInput.value.trim().length > 0; });
    fullNameInput.addEventListener("input", () => {
      if (usernameManual) return;
      usernameInput.value = fullNameInput.value.toLowerCase().trim().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").slice(0, 30);
    });

    // Toggle dropdown vendor
    const roleSelect = document.getElementById("selectNewUserRole");
    const vendorWrapper = document.getElementById("vendorSelectWrapper");
    roleSelect.addEventListener("change", () => {
      vendorWrapper.style.display = roleSelect.value === "VENDOR" ? "block" : "none";
    });

    // Submit Create Vendor
    document.getElementById("formCreateVendor").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = e.target.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        const res = await SmartJApi.post("adminCreateVendor", Object.fromEntries(fd.entries()));
        if (!res.success) throw new Error(res.message);
        await loadUsersVendorsView();
        showInlineBanner("uvAlertBanner", res.message, "success");
      } catch (err) {
        showInlineBanner("uvAlertBanner", err.message, "error");
        btn.disabled = false;
      }
    });

    // Submit Create User
    document.getElementById("formCreateUser").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.username = String(payload.username || "").trim();
      payload.password = String(payload.password || "").trim();
      const btn = e.target.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        const res = await SmartJApi.post("adminCreateUser", payload);
        if (!res.success) throw new Error(res.message);

        lastCreatedCredential = {
          username: payload.username,
          password: payload.password,
          fullName: payload.fullName,
          role: payload.role,
          isReset: false
        };
        await loadUsersVendorsView();
      } catch (err) {
        showInlineBanner("uvAlertBanner", err.message, "error");
        btn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
  }
}

async function handleToggleUser(targetUserId) {
  if (!confirm("Ubah status aktif/nonaktif akun ini?")) return;
  try {
    const res = await SmartJApi.post("adminToggleUserStatus", { targetUserId });
    if (!res.success) throw new Error(res.message);
    await loadUsersVendorsView();
    showInlineBanner("uvAlertBanner", res.message, "success");
  } catch (err) {
    showInlineBanner("uvAlertBanner", err.message, "error");
  }
}

async function handleResetUserPwdFromBtn(btn) {
  const targetUserId = btn.getAttribute("data-uid");
  const username = btn.getAttribute("data-uname");
  const fullName = btn.getAttribute("data-fname");
  const role = btn.getAttribute("data-role");

  if (!confirm(`Generate password baru otomatis untuk akun "${username}"?`)) return;
  const newPassword = generateRandomPassword(10);
  try {
    const res = await SmartJApi.post("adminResetPassword", { targetUserId, newPassword });
    if (!res.success) throw new Error(res.message);

    lastCreatedCredential = { username, password: newPassword, fullName, role, isReset: true };
    await loadUsersVendorsView();
  } catch (err) {
    showInlineBanner("uvAlertBanner", err.message, "error");
  }
}

// =========================================================================
// VIEW B: MASTER PROJECT & SYARAT DOKUMEN (ADMIN) | INPUT PO & ITEM (VENDOR)
// =========================================================================
async function loadMasterDataView(isVendorView = false) {
  document.getElementById("pageTitle").textContent = isVendorView
    ? "PO / Kontrak Saya & Rincian Item Material"
    : "Master Project, Syarat Dokumen & Monitoring PO";
  document.getElementById("pageSubtitle").textContent = isVendorView
    ? "Input dan kelola data PO/Kontrak serta rincian kuota item material Anda"
    : "Kelola master data Project, syarat dokumen khusus PO, dan pantau kuota pengiriman vendor";

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat data project, PO, dan syarat dokumen...</span>
    </div>
  `;

  try {
    const res = await SmartJApi.post("getMasterData", {});
    if (!res.success) throw new Error(res.message);

    cachedMasterData = res.data;
    const { vendors, projects, poContracts, poItems, docRequirements } = res.data;
    const vendorMap = {};
    vendors.forEach(v => { vendorMap[v.VENDOR_ID] = v.VENDOR_NAME; });
    const projMap = {};
    projects.forEach(p => { projMap[p.PROJECT_ID] = `${p.PROJECT_CODE} - ${p.PROJECT_NAME}`; });
    const poMap = {};
    poContracts.forEach(po => { poMap[po.PO_ID] = po.PO_NUMBER; });

    container.innerHTML = `
      <div id="mdAlertBanner" class="hidden"></div>
      ${renderUniversalEditModalHtml()}

      ${!isVendorView ? `
      <!-- PANEL KHUSUS ADMIN: TAMBAH PROJECT & TAMBAH SYARAT DOKUMEN PO -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <i class="fa-solid fa-diagram-project text-blue-700"></i>
            <span>1. Tambah Project Baru</span>
          </h3>
          <form id="formCreateProject" class="space-y-3 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Kode Project *</label>
                <input type="text" name="projectCode" required placeholder="PRJ-KPL-02"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nama Project *</label>
                <input type="text" name="projectName" required placeholder="Kapal Tanker 02"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tgl Mulai</label>
                <input type="date" name="startDate" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tgl Selesai</label>
                <input type="date" name="endDate" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Deskripsi</label>
              <input type="text" name="description" placeholder="Keterangan proyek"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg">
              + Simpan Project
            </button>
          </form>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <i class="fa-solid fa-file-circle-plus text-amber-600"></i>
            <span>2. Tambah Syarat Dokumen Khusus PO</span>
          </h3>
          <p class="text-[11px] text-slate-500 mb-3">
            Setiap PO otomatis memiliki 6 syarat dokumen standar. Tambahkan syarat dokumen khusus di sini jika diperlukan:
          </p>
          <form id="formAdminAddDocReq" class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Pilih PO Vendor *</label>
              <select name="poId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Nomor PO --</option>
                ${poContracts.map(po => `<option value="${po.PO_ID}">${po.PO_NUMBER} (${vendorMap[po.VENDOR_ID] || ""})</option>`).join("")}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Kode Dokumen *</label>
                <input type="text" name="docCode" required placeholder="DOC-NDT / DOC-COO"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Format Diizinkan</label>
                <input type="text" name="allowedFormats" value="pdf,jpg,jpeg,png"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Nama Dokumen Tambahan *</label>
              <input type="text" name="documentName" required placeholder="Contoh: Certificate of Origin / Sertifikat NDT"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Keterangan / Instruksi</label>
              <input type="text" name="description" placeholder="Catatan singkat kelengkapan dokumen"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg">
              + Tambah Syarat Dokumen PO
            </button>
          </form>
        </div>
      </div>

      <!-- Tabel Daftar Project (Admin) -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-800">Daftar Project Terdaftar (${projects.length})</h3>
          <span class="text-[11px] text-slate-500">PO & Item Material diinput oleh masing-masing Vendor</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Kode Project</th>
                <th class="py-3 px-4">Nama Project</th>
                <th class="py-3 px-4">Periode</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${projects.length === 0 ? `<tr><td colspan="5" class="py-6 text-center text-slate-400">Belum ada data project.</td></tr>` : projects.map(p => `
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-mono font-bold text-blue-900">${p.PROJECT_CODE}</td>
                  <td class="py-3 px-4">
                    <div class="font-semibold text-slate-800">${p.PROJECT_NAME}</div>
                    <div class="text-[11px] text-slate-500">${p.DESCRIPTION || "-"}</div>
                  </td>
                  <td class="py-3 px-4 text-slate-600">${fmtDate(p.START_DATE)} s/d ${fmtDate(p.END_DATE)}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">${p.STATUS}</span>
                  </td>
                  <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    <button onclick="openEditModal('PROJECT', '${p.PROJECT_ID}')"
                      class="px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-medium">
                      <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button onclick="handleDeleteEntity('PROJECT', '${p.PROJECT_ID}', '${p.PROJECT_CODE}')"
                      class="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-medium">
                      <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
      ` : `
      <!-- PANEL VENDOR: INPUT PO & ITEM MATERIAL -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <i class="fa-solid fa-file-contract text-blue-700"></i>
            <span>1. Input PO / Kontrak Baru</span>
          </h3>
          <form id="formVendorCreatePO" class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Pilih Project *</label>
              <select name="projectId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Project Aktif --</option>
                ${projects.map(p => `<option value="${p.PROJECT_ID}">${p.PROJECT_CODE} - ${p.PROJECT_NAME}</option>`).join("")}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nomor PO *</label>
                <input type="text" name="poNumber" required placeholder="PO/2026/099"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nomor Kontrak</label>
                <input type="text" name="contractNumber" placeholder="KTR/2026/025"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Tanggal PO</label>
              <input type="date" name="poDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Deskripsi Pengadaan</label>
              <input type="text" name="description" placeholder="Uraian singkat paket material"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div class="p-2.5 rounded-lg bg-blue-50 text-blue-800 text-[11px]">
              <i class="fa-solid fa-circle-info mr-1"></i>
              Otomatis dilengkapi <strong>6 syarat dokumen standar</strong> (Packing List, Sertifikat, Surat Jalan, Foto Material, Kendaraan & Pengirim).
            </div>
            <button type="submit" class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg">
              + Simpan PO / Kontrak
            </button>
          </form>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <i class="fa-solid fa-boxes-stacked text-emerald-700"></i>
            <span>2. Tambah Item Material PO</span>
          </h3>
          <form id="formVendorAddPOItem" class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Pilih PO Saya *</label>
              <select name="poId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Nomor PO --</option>
                ${poContracts.map(po => `<option value="${po.PO_ID}">${po.PO_NUMBER}</option>`).join("")}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Kode Material</label>
                <input type="text" name="itemCode" placeholder="MAT-001"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nama Material *</label>
                <input type="text" name="materialName" required placeholder="Marine Steel Plate"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Spesifikasi Material</label>
              <input type="text" name="specification" placeholder="Grade A 12mm x 1500 x 6000"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Total Kuota Qty PO *</label>
                <input type="number" step="any" min="0.01" name="qtyPo" required placeholder="100"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Satuan (UOM) *</label>
                <input type="text" name="uom" required placeholder="Lembar / Set / Kg"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <button type="submit" class="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg">
              + Tambahkan Item ke PO
            </button>
          </form>
        </div>
      </div>
      `}

      <!-- TABEL DAFTAR PO / KONTRAK -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800">Daftar PO / Kontrak (${poContracts.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">No. PO / Kontrak</th>
                <th class="py-3 px-4">Project</th>
                <th class="py-3 px-4">Vendor</th>
                <th class="py-3 px-4">Deskripsi</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${poContracts.length === 0 ? `<tr><td colspan="6" class="py-6 text-center text-slate-400">Belum ada data PO.</td></tr>` : poContracts.map(po => `
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4">
                    <div class="font-bold text-blue-900">${po.PO_NUMBER}</div>
                    <div class="text-[11px] text-slate-500">${po.CONTRACT_NUMBER || "-"}</div>
                  </td>
                  <td class="py-3 px-4 text-slate-700">${projMap[po.PROJECT_ID] || po.PROJECT_ID}</td>
                  <td class="py-3 px-4 font-medium text-slate-800">${vendorMap[po.VENDOR_ID] || po.VENDOR_ID}</td>
                  <td class="py-3 px-4 text-slate-600">${po.DESCRIPTION || "-"}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${po.STATUS === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}">
                      ${po.STATUS}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    <button onclick="openEditModal('PO', '${po.PO_ID}')"
                      class="px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-medium">
                      <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button onclick="handleDeleteEntity('PO', '${po.PO_ID}', '${po.PO_NUMBER}')"
                      class="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-medium">
                      <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABEL RINCIAN ITEM PO & SISA KUOTA PARTIAL DELIVERY -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800">Rincian Item Material & Saldo Kuota Partial Delivery (${poItems.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">No. PO</th>
                <th class="py-3 px-4">Material & Spesifikasi</th>
                <th class="py-3 px-4 text-right">Kuota PO</th>
                <th class="py-3 px-4 text-right">Sudah Diterima (MRR)</th>
                <th class="py-3 px-4 text-right">Dalam Perjalanan</th>
                <th class="py-3 px-4 text-right">Sisa Kuota</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${poItems.length === 0 ? `<tr><td colspan="7" class="py-6 text-center text-slate-400">Belum ada item material PO.</td></tr>` : poItems.map(item => `
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-semibold text-blue-900">${poMap[item.PO_ID] || item.PO_ID}</td>
                  <td class="py-3 px-4">
                    <div class="font-semibold text-slate-800">${item.MATERIAL_NAME}</div>
                    <div class="text-[11px] text-slate-500">${item.ITEM_CODE || ""} ${item.SPECIFICATION ? "• " + item.SPECIFICATION : ""}</div>
                  </td>
                  <td class="py-3 px-4 text-right font-semibold">${fmtNumber(item.QTY_PO)} ${item.UOM}</td>
                  <td class="py-3 px-4 text-right text-emerald-700 font-semibold">${fmtNumber(item.QTY_RECEIVED)} ${item.UOM}</td>
                  <td class="py-3 px-4 text-right text-amber-700">${fmtNumber(item.QTY_IN_TRANSIT)} ${item.UOM}</td>
                  <td class="py-3 px-4 text-right font-bold text-blue-800">${fmtNumber(item.QTY_REMAINING)} ${item.UOM}</td>
                  <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    <button onclick="openEditModal('PO_ITEM', '${item.PO_ITEM_ID}')"
                      class="px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-medium">
                      <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button onclick="handleDeleteEntity('PO_ITEM', '${item.PO_ITEM_ID}', '${item.MATERIAL_NAME}')"
                      class="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-medium">
                      <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABEL SYARAT DOKUMEN PER PO -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800">Checklist Syarat Dokumen Pra-Pengiriman (${docRequirements.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">No. PO</th>
                <th class="py-3 px-4">Kode</th>
                <th class="py-3 px-4">Nama Dokumen</th>
                <th class="py-3 px-4">Sifat</th>
                <th class="py-3 px-4">Format</th>
                <th class="py-3 px-4">Keterangan</th>
                ${!isVendorView ? `<th class="py-3 px-4 text-right">Aksi</th>` : ""}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${docRequirements.length === 0 ? `<tr><td colspan="${!isVendorView ? 7 : 6}" class="py-6 text-center text-slate-400">Belum ada syarat dokumen.</td></tr>` : docRequirements.map(doc => {
                const mand = String(doc.IS_MANDATORY).toUpperCase() === "TRUE";
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-4 font-semibold text-blue-900">${poMap[doc.PO_ID] || doc.PO_ID}</td>
                    <td class="py-3 px-4 font-mono text-slate-700">${doc.DOC_CODE}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800">${doc.DOCUMENT_NAME}</td>
                    <td class="py-3 px-4">
                      <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${mand ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-100 text-slate-600"}">
                        ${mand ? "WAJIB" : "OPSIONAL"}
                      </span>
                    </td>
                    <td class="py-3 px-4 font-mono text-[11px] text-slate-600">${doc.ALLOWED_FORMATS}</td>
                    <td class="py-3 px-4 text-slate-500">${doc.DESCRIPTION || "-"}</td>
                    ${!isVendorView ? `
                      <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <button onclick="openEditModal('DOC_REQ', '${doc.REQUIREMENT_ID}')"
                          class="px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-medium">
                          <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button onclick="handleDeleteEntity('DOC_REQ', '${doc.REQUIREMENT_ID}', '${doc.DOCUMENT_NAME}')"
                          class="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-medium">
                          <i class="fa-solid fa-trash"></i> Hapus
                        </button>
                      </td>
                    ` : ""}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindMasterDataForms(isVendorView);
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
  }
}

function bindMasterDataForms(isVendorView) {
  if (!isVendorView) {
    document.getElementById("formCreateProject").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      try {
        const res = await SmartJApi.post("adminCreateProject", payload);
        if (!res.success) throw new Error(res.message);
        await loadMasterDataView(false);
        showInlineBanner("mdAlertBanner", res.message, "success");
      } catch (err) {
        showInlineBanner("mdAlertBanner", err.message, "error");
      }
    });

    document.getElementById("formAdminAddDocReq").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      try {
        const res = await SmartJApi.post("adminAddDocRequirement", payload);
        if (!res.success) throw new Error(res.message);
        await loadMasterDataView(false);
        showInlineBanner("mdAlertBanner", res.message, "success");
      } catch (err) {
        showInlineBanner("mdAlertBanner", err.message, "error");
      }
    });
    return;
  }

  document.getElementById("formVendorCreatePO").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.autoSeedDefaultDocs = true;
    try {
      const res = await SmartJApi.post("adminCreatePO", payload);
      if (!res.success) throw new Error(res.message);
      await loadMasterDataView(true);
      showInlineBanner("mdAlertBanner", res.message, "success");
    } catch (err) {
      showInlineBanner("mdAlertBanner", err.message, "error");
    }
  });

  document.getElementById("formVendorAddPOItem").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await SmartJApi.post("adminAddPOItem", payload);
      if (!res.success) throw new Error(res.message);
      await loadMasterDataView(true);
      showInlineBanner("mdAlertBanner", res.message, "success");
    } catch (err) {
      showInlineBanner("mdAlertBanner", err.message, "error");
    }
  });
}
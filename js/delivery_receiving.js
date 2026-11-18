/**
 * SMART-J FRONTEND - TAHAP 3
 * Modul Pra-Pengiriman Vendor (Upload Dokumen & Kuota Partial)
 * & Modul Receiving (Verifikasi Dokumen, Konfirmasi Kedatangan, Penerbitan MRR)
 */

let cachedMasterForDelivery = null;
let cachedDeliveriesList = [];

function statusBadge(status) {
  const st = String(status || "").toUpperCase();
  const map = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    DOCUMENT_VERIFIED: "bg-indigo-100 text-indigo-800",
    REVISION_REQUIRED: "bg-red-100 text-red-800",
    ARRIVAL_CONFIRMED: "bg-amber-100 text-amber-800",
    PARTIALLY_RECEIVED: "bg-teal-100 text-teal-800",
    RECEIVED: "bg-emerald-100 text-emerald-800",
    MRR_ISSUED: "bg-emerald-100 text-emerald-800",
    CANCELLED: "bg-slate-200 text-slate-700"
  };
  return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[st] || "bg-slate-100 text-slate-700"}">${st || "-"}</span>`;
}

// =========================================================================
// VIEW A: MENU RENCANA PENGIRIMAN (VENDOR) & VALIDASI KEDATANGAN (RECEIVING/ADMIN)
// =========================================================================
async function loadDeliveriesView(user) {
  const isVendor = user.role === "VENDOR";
  document.getElementById("pageTitle").textContent = isVendor
    ? "Rencana Pengiriman & Upload Dokumen Pra-Kirim"
    : "Validasi Dokumen & Monitoring Kedatangan Material";
  document.getElementById("pageSubtitle").textContent = isVendor
    ? "Ajukan pengiriman batch baru sesuai sisa kuota PO dan lengkapi seluruh dokumen wajib"
    : "Periksa kelengkapan dokumen pra-kirim vendor sebelum material diproses penerbitan MRR";

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat data rencana pengiriman...</span>
    </div>
  `;

  try {
    const requests = [SmartJApi.post("getDeliveryList", {})];
    if (isVendor) {
      requests.push(SmartJApi.post("getMasterData", {}));
    }

    const [delRes, masterRes] = await Promise.all(requests);
    if (!delRes.success) throw new Error(delRes.message);
    if (isVendor && !masterRes.success) throw new Error(masterRes.message);

    cachedDeliveriesList = delRes.deliveries || [];
    cachedMasterForDelivery = isVendor ? masterRes.data : null;

    const activePOs = isVendor
      ? (cachedMasterForDelivery.poContracts || []).filter(p => String(p.STATUS).toUpperCase() === "ACTIVE")
      : [];

    container.innerHTML = `
      <div id="delAlertBanner" class="hidden"></div>

      ${isVendor ? `
      <!-- FORM VENDOR: AJUKAN RENCANA PENGIRIMAN BARU -->
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="fa-solid fa-truck-ramp-box text-blue-700"></i>
          <span>Buat Pengajuan Pengiriman Baru (Pra-Kedatangan)</span>
        </h3>

        <form id="formVendorSubmitDelivery" class="space-y-4 text-xs">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Pilih Nomor PO Aktif *</label>
              <select id="selectDeliveryPO" name="poId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih PO --</option>
                ${activePOs.map(po => `<option value="${po.PO_ID}">${po.PO_NUMBER} (${po.CONTRACT_NUMBER || "Tanpa Kontrak"})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Rencana Tanggal Tiba *</label>
              <input type="date" name="plannedArrivalDate" required class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">No. Polisi Kendaraan *</label>
              <input type="text" name="vehiclePlate" required placeholder="L 1234 AB" class="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Nama Pengemudi / Kurir *</label>
              <input type="text" name="driverName" required placeholder="Nama sopir pengantar" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">No. HP Pengemudi *</label>
              <input type="text" name="driverPhone" required placeholder="0812..." class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Catatan Pengiriman</label>
              <input type="text" name="notes" placeholder="Contoh: Pengiriman Batch 1" class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>

          <!-- Area Dinamis: Rincian Kuantitas Item PO & Syarat Dokumen PO -->
          <div id="dynamicPODeliveryFields" class="hidden space-y-4 pt-2 border-t border-slate-200">
            <div>
              <h4 class="font-bold text-slate-800 mb-2">1. Isi Kuantitas Item Material yang Dikirim (Maksimal Sesuai Sisa Kuota)</h4>
              <div id="vendorDeliveryItemsBox" class="overflow-x-auto border border-slate-200 rounded-lg"></div>
            </div>

            <div>
              <h4 class="font-bold text-slate-800 mb-2">2. Unggah Dokumen & Foto Wajib Sesuai Persyaratan PO (Maks. 10 MB/file)</h4>
              <div id="vendorDeliveryDocsBox" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
            </div>

            <button type="submit" id="btnSubmitDelivery"
              class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
              <i class="fa-solid fa-paper-plane"></i>
              <span>Kirim Pengajuan & Unggah Semua Dokumen</span>
            </button>
          </div>
        </form>
      </div>
      ` : ""}

      <!-- TABEL DAFTAR RENCANA PENGIRIMAN -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-bold text-slate-800">Daftar Rencana Pengiriman (${cachedDeliveriesList.length})</h3>
          <select id="filterDeliveryStatus" class="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
            <option value="ALL">Semua Status</option>
            <option value="SUBMITTED">SUBMITTED (Menunggu Verifikasi)</option>
            <option value="REVISION_REQUIRED">REVISION_REQUIRED (Perlu Revisi)</option>
            <option value="DOCUMENT_VERIFIED">DOCUMENT_VERIFIED (Siap Terbit MRR)</option>
            <option value="PARTIALLY_RECEIVED">PARTIALLY_RECEIVED</option>
            <option value="RECEIVED">RECEIVED</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">ID / Tgl Rencana</th>
                <th class="py-3 px-4">No. PO & Vendor</th>
                <th class="py-3 px-4">Armada & Pengemudi</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody id="deliveryTableBody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
      </div>

      <!-- MODAL / PANEL DETAIL & VERIFIKASI DOKUMEN PENGIRIMAN -->
      <div id="deliveryDetailModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 id="delModalTitle" class="text-base font-bold text-slate-800">Detail Pengiriman</h3>
            <button type="button" onclick="closeDeliveryModal()" class="text-slate-400 hover:text-slate-700 text-lg">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="delModalBody" class="p-6 text-xs space-y-5"></div>
        </div>
      </div>
    `;

    renderDeliveriesTable("ALL", user);
    document.getElementById("filterDeliveryStatus").addEventListener("change", (e) => {
      renderDeliveriesTable(e.target.value, user);
    });

    if (isVendor) {
      bindVendorDeliveryForm();
    }
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
  }
}

function renderDeliveriesTable(statusFilter, user) {
  const tbody = document.getElementById("deliveryTableBody");
  const filtered = statusFilter === "ALL"
    ? cachedDeliveriesList
    : cachedDeliveriesList.filter(d => String(d.STATUS).toUpperCase() === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada data pengiriman pada filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(d => `
    <tr class="hover:bg-slate-50">
      <td class="py-3 px-4">
        <div class="font-mono font-bold text-slate-800">${d.DELIVERY_ID}</div>
        <div class="text-[11px] text-slate-500">Tiba: ${fmtDate(d.PLANNED_ARRIVAL_DATE)}</div>
      </td>
      <td class="py-3 px-4">
        <div class="font-bold text-blue-900">${d.PO_NUMBER || d.PO_ID}</div>
        <div class="text-[11px] text-slate-600">${d.VENDOR_NAME || d.VENDOR_ID}</div>
      </td>
      <td class="py-3 px-4">
        <div class="font-semibold text-slate-800">${d.VEHICLE_PLATE || "-"}</div>
        <div class="text-[11px] text-slate-500">${d.DRIVER_NAME || "-"} (${d.DRIVER_PHONE || "-"})</div>
      </td>
      <td class="py-3 px-4">${statusBadge(d.STATUS)}</td>
      <td class="py-3 px-4 text-right">
        <button onclick="openDeliveryDetailModal('${d.DELIVERY_ID}')"
          class="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold border border-blue-200">
          ${user.role === "VENDOR" && d.STATUS === "REVISION_REQUIRED" ? "Revisi Dokumen" : "Detail & Dokumen"}
        </button>
      </td>
    </tr>
  `).join("");
}

function bindVendorDeliveryForm() {
  const poSelect = document.getElementById("selectDeliveryPO");
  const dynamicBox = document.getElementById("dynamicPODeliveryFields");
  const itemsBox = document.getElementById("vendorDeliveryItemsBox");
  const docsBox = document.getElementById("vendorDeliveryDocsBox");

  poSelect.addEventListener("change", () => {
    const poId = poSelect.value;
    if (!poId) {
      dynamicBox.classList.add("hidden");
      return;
    }

    const items = (cachedMasterForDelivery.poItems || []).filter(i => String(i.PO_ID) === poId);
    const docs = (cachedMasterForDelivery.docRequirements || []).filter(r => String(r.PO_ID) === poId);

    if (items.length === 0) {
      itemsBox.innerHTML = `<div class="p-4 text-red-700 bg-red-50">PO ini belum memiliki item material. Tambahkan item terlebih dahulu di menu PO & Kuota Pengiriman.</div>`;
    } else {
      itemsBox.innerHTML = `
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th class="py-2 px-3">Material</th>
              <th class="py-2 px-3 text-right">Sisa Kuota</th>
              <th class="py-2 px-3 text-right w-40">Qty Dikirim Sekarang</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${items.map(it => {
              const available = Math.max(0, Number(it.QTY_REMAINING || 0) - Number(it.QTY_IN_TRANSIT || 0));
              return `
                <tr>
                  <td class="py-2 px-3">
                    <div class="font-semibold text-slate-800">${it.MATERIAL_NAME}</div>
                    <div class="text-[11px] text-slate-500">${it.SPECIFICATION || "-"}</div>
                  </td>
                  <td class="py-2 px-3 text-right font-semibold text-blue-800">${fmtNumber(available)} ${it.UOM}</td>
                  <td class="py-2 px-3 text-right">
                    <input type="number" step="any" min="0" max="${available}" value="${available > 0 ? available : 0}"
                      data-po-item-id="${it.PO_ITEM_ID}" data-uom="${it.UOM}"
                      class="del-qty-input w-28 px-2 py-1 border border-slate-300 rounded text-right font-semibold" />
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    docsBox.innerHTML = docs.map(doc => {
      const mand = String(doc.IS_MANDATORY).toUpperCase() === "TRUE";
      return `
        <div class="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800">${doc.DOCUMENT_NAME}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${mand ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"}">
              ${mand ? "WAJIB" : "OPSIONAL"}
            </span>
          </div>
          <div class="text-[11px] text-slate-500">${doc.DESCRIPTION || ""} (Format: ${doc.ALLOWED_FORMATS})</div>
          <input type="file" ${mand ? "required" : ""}
            data-req-id="${doc.REQUIREMENT_ID}" data-doc-code="${doc.DOC_CODE}"
            class="del-doc-file-input w-full text-[11px] file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-blue-700 file:text-white hover:file:bg-blue-800" />
        </div>
      `;
    }).join("");

    dynamicBox.classList.remove("hidden");
  });

  document.getElementById("formVendorSubmitDelivery").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitDelivery");
    const fd = new FormData(e.target);

    // Kumpulkan item dengan qty > 0
    const items = [];
    document.querySelectorAll(".del-qty-input").forEach(inp => {
      const qty = Number(inp.value || 0);
      if (qty > 0) {
        items.push({
          poItemId: inp.getAttribute("data-po-item-id"),
          qtySent: qty,
          uom: inp.getAttribute("data-uom")
        });
      }
    });

    if (items.length === 0) {
      showInlineBanner("delAlertBanner", "Minimal satu item material harus memiliki Qty Dikirim > 0.", "error");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Mengonversi & Mengunggah File ke Drive...</span>';

    try {
      const files = [];
      const fileInputs = Array.from(document.querySelectorAll(".del-doc-file-input"));
      for (const inp of fileInputs) {
        if (inp.files && inp.files.length > 0) {
          const f = inp.files[0];
          if (f.size > 10 * 1024 * 1024) {
            throw new Error(`Ukuran file "${f.name}" melebihi batas 10 MB.`);
          }
          const b64Obj = await SmartJApi.fileToBase64Object(f);
          files.push({
            requirementId: inp.getAttribute("data-req-id"),
            docCode: inp.getAttribute("data-doc-code"),
            ...b64Obj
          });
        }
      }

      const payload = {
        poId: fd.get("poId"),
        plannedArrivalDate: fd.get("plannedArrivalDate"),
        vehiclePlate: fd.get("vehiclePlate"),
        driverName: fd.get("driverName"),
        driverPhone: fd.get("driverPhone"),
        notes: fd.get("notes"),
        items: items,
        files: files
      };

      const res = await SmartJApi.post("vendorSubmitDelivery", payload);
      if (!res.success) throw new Error(res.message);

      await loadDeliveriesView(SmartJApi.getUser());
      showInlineBanner("delAlertBanner", res.message, "success");
    } catch (err) {
      showInlineBanner("delAlertBanner", err.message, "error");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>Kirim Pengajuan & Unggah Semua Dokumen</span>';
    }
  });
}

async function openDeliveryDetailModal(deliveryId) {
  const modal = document.getElementById("deliveryDetailModal");
  const body = document.getElementById("delModalBody");
  const user = SmartJApi.getUser();

  modal.classList.remove("hidden");
  body.innerHTML = `<div class="py-10 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat rincian pengiriman...</div>`;

  try {
    const res = await SmartJApi.post("getDeliveryDetail", { deliveryId });
    if (!res.success) throw new Error(res.message);

    const { delivery, po, vendor, items, files } = res.detail;
    const isReceivingOrAdmin = ["RECEIVING", "ADMIN"].includes(user.role);
    const isVendorRevision = user.role === "VENDOR" && String(delivery.STATUS).toUpperCase() === "REVISION_REQUIRED";

    document.getElementById("delModalTitle").textContent = `Detail Pengiriman: ${delivery.DELIVERY_ID} (${po.PO_NUMBER || ""})`;

    body.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div><span class="text-slate-500 block">Vendor</span><strong class="text-slate-800">${vendor.VENDOR_NAME || "-"}</strong></div>
        <div><span class="text-slate-500 block">Rencana Tiba</span><strong class="text-slate-800">${fmtDate(delivery.PLANNED_ARRIVAL_DATE)}</strong></div>
        <div><span class="text-slate-500 block">Armada / Sopir</span><strong class="text-slate-800">${delivery.VEHICLE_PLATE} • ${delivery.DRIVER_NAME}</strong></div>
        <div><span class="text-slate-500 block">Status</span>${statusBadge(delivery.STATUS)}</div>
      </div>

      <!-- Daftar Item Dikirim -->
      <div>
        <h4 class="font-bold text-slate-800 mb-2">Rincian Item Material Dikirim</h4>
        <table class="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th class="py-2 px-3">Material</th>
              <th class="py-2 px-3">Spesifikasi</th>
              <th class="py-2 px-3 text-right">Qty Dikirim</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${items.map(it => `
              <tr>
                <td class="py-2 px-3 font-semibold">${it.MATERIAL_NAME || it.PO_ITEM_ID}</td>
                <td class="py-2 px-3 text-slate-500">${it.SPECIFICATION || "-"}</td>
                <td class="py-2 px-3 text-right font-bold text-blue-800">${fmtNumber(it.QTY_SENT)} ${it.UOM}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Daftar Dokumen & Foto Lampiran -->
      <div>
        <h4 class="font-bold text-slate-800 mb-2">Dokumen & Foto Pra-Pengiriman (${files.length} File)</h4>
        <div class="space-y-2.5">
          ${files.map(f => `
            <div class="p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div class="space-y-0.5">
                <div class="font-bold text-slate-800">[${f.DOC_CODE}] ${f.FILE_NAME}</div>
                <div class="text-[11px] text-slate-500">Status File: <strong>${f.FILE_STATUS || "UPLOADED"}</strong> ${f.REMARKS ? `• Catatan: <span class="text-red-600">${f.REMARKS}</span>` : ""}</div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" onclick="SmartJApi.downloadPrivateFile('${f.DRIVE_FILE_ID}')"
                  class="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium">
                  <i class="fa-solid fa-download mr-1"></i>Unduh / Cek File
                </button>
                ${isReceivingOrAdmin ? `
                  <select data-del-file-id="${f.DELIVERY_FILE_ID}" class="rec-file-status px-2 py-1.5 border border-slate-300 rounded bg-white">
                    <option value="ACCEPTED" ${f.FILE_STATUS === "ACCEPTED" ? "selected" : ""}>ACCEPTED</option>
                    <option value="REJECTED" ${f.FILE_STATUS === "REJECTED" ? "selected" : ""}>REJECTED</option>
                  </select>
                  <input type="text" data-del-file-rem="${f.DELIVERY_FILE_ID}" value="${f.REMARKS || ""}" placeholder="Catatan file..."
                    class="rec-file-rem px-2 py-1.5 border border-slate-300 rounded w-36" />
                ` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      ${isReceivingOrAdmin ? `
      <!-- PANEL KEPUTUSAN VERIFIKASI DOKUMEN OLEH RECEIVING -->
      <div class="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
        <h4 class="font-bold text-blue-950">Keputusan Verifikasi Kelengkapan Dokumen</h4>
        <input type="text" id="recVerifyNote" placeholder="Catatan umum untuk vendor (wajib diisi jika meminta revisi)..."
          class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" />
        <div class="flex flex-wrap gap-3">
          <button type="button" onclick="submitReceivingDocVerify('${delivery.DELIVERY_ID}', 'DOCUMENT_VERIFIED')"
            class="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
            <i class="fa-solid fa-check-circle mr-1"></i>Setujui Dokumen (DOCUMENT_VERIFIED)
          </button>
          <button type="button" onclick="submitReceivingDocVerify('${delivery.DELIVERY_ID}', 'REVISION_REQUIRED')"
            class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold">
            <i class="fa-solid fa-rotate-left mr-1"></i>Kembalikan ke Vendor (REVISION_REQUIRED)
          </button>
        </div>
      </div>
      ` : ""}

      ${isVendorRevision ? `
      <!-- PANEL RE-UPLOAD DOKUMEN REVISI OLEH VENDOR -->
      <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
        <h4 class="font-bold text-amber-900">Unggah Ulang Dokumen Revisi</h4>
        <p class="text-[11px] text-amber-800">Pilih file pengganti untuk dokumen yang berstatus REJECTED, lalu kirim ulang ke Receiving:</p>
        <div class="space-y-2">
          ${files.filter(f => f.FILE_STATUS === "REJECTED").map(f => `
            <div class="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded border border-amber-200">
              <div>
                <div class="font-bold">[${f.DOC_CODE}] ${f.FILE_NAME}</div>
                <div class="text-[11px] text-red-600">Alasan ditolak: ${f.REMARKS || "Perlu perbaikan"}</div>
              </div>
              <input type="file" required data-req-id="${f.REQUIREMENT_ID}" data-doc-code="${f.DOC_CODE}"
                class="rev-upload-input text-[11px]" />
            </div>
          `).join("")}
        </div>
        <button type="button" onclick="submitVendorRevisionFiles('${delivery.DELIVERY_ID}')"
          class="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-semibold">
          Kirim Ulang Dokumen Revisi
        </button>
      </div>
      ` : ""}
    `;
  } catch (err) {
    body.innerHTML = `<div class="p-4 bg-red-50 text-red-800 rounded-lg">${err.message}</div>`;
  }
}

function closeDeliveryModal() {
  document.getElementById("deliveryDetailModal").classList.add("hidden");
}

async function submitReceivingDocVerify(deliveryId, decision) {
  const fileReviews = [];
  document.querySelectorAll(".rec-file-status").forEach(sel => {
    const id = sel.getAttribute("data-del-file-id");
    const remInput = document.querySelector(`.rec-file-rem[data-del-file-rem="${id}"]`);
    fileReviews.push({
      deliveryFileId: id,
      fileStatus: sel.value,
      remarks: remInput ? remInput.value.trim() : ""
    });
  });

  const note = document.getElementById("recVerifyNote").value.trim();
  try {
    const res = await SmartJApi.post("receivingVerifyDocuments", {
      deliveryId,
      decision,
      fileReviews,
      note
    });
    if (!res.success) throw new Error(res.message);
    closeDeliveryModal();
    await loadDeliveriesView(SmartJApi.getUser());
    showInlineBanner("delAlertBanner", res.message, "success");
  } catch (err) {
    alert("Gagal memverifikasi dokumen: " + err.message);
  }
}

async function submitVendorRevisionFiles(deliveryId) {
  try {
    const files = [];
    for (const inp of Array.from(document.querySelectorAll(".rev-upload-input"))) {
      if (inp.files && inp.files.length > 0) {
        const b64Obj = await SmartJApi.fileToBase64Object(inp.files[0]);
        files.push({
          requirementId: inp.getAttribute("data-req-id"),
          docCode: inp.getAttribute("data-doc-code"),
          ...b64Obj
        });
      }
    }
    if (files.length === 0) {
      alert("Pilih minimal satu file revisi terlebih dahulu.");
      return;
    }

    const res = await SmartJApi.post("vendorResubmitDelivery", { deliveryId, files });
    if (!res.success) throw new Error(res.message);
    closeDeliveryModal();
    await loadDeliveriesView(SmartJApi.getUser());
    showInlineBanner("delAlertBanner", res.message, "success");
  } catch (err) {
    alert("Gagal mengirim revisi: " + err.message);
  }
}

// =========================================================================
// VIEW B: PENERBITAN MRR DIGITAL & DAFTAR MRR TERBIT (RECEIVING / ADMIN / INSPECTOR)
// =========================================================================
async function loadReceivingMRRView(user) {
  const canIssueMRR = ["RECEIVING", "ADMIN"].includes(user.role);
  document.getElementById("pageTitle").textContent = canIssueMRR
    ? "Penerbitan MRR Digital & Daftar MRR Terbit"
    : "Daftar Material Receiving Report (MRR)";
  document.getElementById("pageSubtitle").textContent = canIssueMRR
    ? "Konfirmasi kedatangan fisik material, catat kuantitas aktual diterima, dan terbitkan nomor MRR otomatis"
    : "Daftar MRR yang telah diterbitkan tim Receiving";

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat data MRR dan antrian kedatangan...</span>
    </div>
  `;

  try {
    const requests = [SmartJApi.post("getMRRList", {})];
    if (canIssueMRR) {
      requests.push(SmartJApi.post("getDeliveryList", {}));
    }

    const [mrrRes, delRes] = await Promise.all(requests);
    if (!mrrRes.success) throw new Error(mrrRes.message);

    const mrrList = mrrRes.mrrList || [];
    const readyDeliveries = canIssueMRR
      ? (delRes.deliveries || []).filter(d => ["DOCUMENT_VERIFIED", "SUBMITTED", "ARRIVAL_CONFIRMED"].includes(String(d.STATUS).toUpperCase()))
      : [];

    container.innerHTML = `
      <div id="mrrAlertBanner" class="hidden"></div>

      ${canIssueMRR ? `
      <!-- FORM RECEIVING: KONFIRMASI KEDATANGAN FISIK & TERBITKAN MRR OTOMATIS -->
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="fa-solid fa-file-invoice text-emerald-700"></i>
          <span>Terbitkan MRR Digital Baru (Penomoran Urut Otomatis)</span>
        </h3>

        <form id="formIssueMRR" class="space-y-4 text-xs">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Pilih Pengiriman Siap Terima *</label>
              <select id="selectDeliveryForMRR" name="deliveryId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Pengiriman (Status DOCUMENT_VERIFIED / SUBMITTED) --</option>
                ${readyDeliveries.map(d => `<option value="${d.DELIVERY_ID}">${d.DELIVERY_ID} | ${d.PO_NUMBER} - ${d.VENDOR_NAME} (${d.VEHICLE_PLATE})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Catatan Penerimaan Fisik</label>
              <input type="text" name="notes" placeholder="Kondisi kemasan, jumlah palet/ikat, dll."
                class="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>

          <div id="mrrItemsVerificationBox" class="hidden space-y-3 pt-2 border-t border-slate-200">
            <h4 class="font-bold text-slate-800">Verifikasi Kuantitas Fisik yang Benar-Benar Diterima di Gudang:</h4>
            <div id="mrrItemsTableContainer" class="overflow-x-auto border border-slate-200 rounded-lg"></div>
            <button type="submit" id="btnSubmitIssueMRR"
              class="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition">
              <i class="fa-solid fa-stamp mr-1"></i>Konfirmasi Kedatangan & Terbitkan Nomor MRR Otomatis
            </button>
          </div>
        </form>
      </div>
      ` : ""}

      <!-- TABEL DAFTAR MRR TERBIT -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-800">Daftar MRR Digital Terbit (${mrrList.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Nomor MRR</th>
                <th class="py-3 px-4">No. PO & Vendor</th>
                <th class="py-3 px-4">Tgl Terbit</th>
                <th class="py-3 px-4">Status Inspeksi QC</th>
                <th class="py-3 px-4">Status Closing</th>
                <th class="py-3 px-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${mrrList.length === 0 ? `<tr><td colspan="6" class="py-6 text-center text-slate-400">Belum ada MRR yang diterbitkan.</td></tr>` : mrrList.map(m => `
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-mono font-bold text-emerald-800">${m.MRR_NUMBER}</td>
                  <td class="py-3 px-4">
                    <div class="font-bold text-blue-900">${m.PO_NUMBER}</div>
                    <div class="text-[11px] text-slate-600">${m.VENDOR_NAME}</div>
                  </td>
                  <td class="py-3 px-4 text-slate-600">${fmtDate(m.MRR_ISSUED_DATETIME)}</td>
                  <td class="py-3 px-4">
                    <span class="font-semibold">${m.LATEST_INSPECTION_RESULT}</span>
                    <span class="text-[11px] text-slate-500 block">Round ${m.LATEST_INSPECTION_ROUND || 0} • ${m.LATEST_INSPECTION_STATUS}</span>
                  </td>
                  <td class="py-3 px-4">${statusBadge(m.CLOSING_STATUS)}</td>
                  <td class="py-3 px-4 text-right">
                    <button onclick="openMRRDetailModal('${m.MRR_ID}')"
                      class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold">
                      Lihat Rincian
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL DETAIL MRR -->
      <div id="mrrDetailModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 id="mrrModalTitle" class="text-base font-bold text-slate-800">Rincian MRR</h3>
            <button type="button" onclick="document.getElementById('mrrDetailModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-700">
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          <div id="mrrModalBody" class="p-6 text-xs space-y-4"></div>
        </div>
      </div>
    `;

    if (canIssueMRR) {
      bindIssueMRRForm();
    }
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
  }
}

function bindIssueMRRForm() {
  const selectDel = document.getElementById("selectDeliveryForMRR");
  const box = document.getElementById("mrrItemsVerificationBox");
  const tableContainer = document.getElementById("mrrItemsTableContainer");

  selectDel.addEventListener("change", async () => {
    const deliveryId = selectDel.value;
    if (!deliveryId) {
      box.classList.add("hidden");
      return;
    }

    box.classList.remove("hidden");
    tableContainer.innerHTML = `<div class="p-4 text-slate-500">Memuat item pengiriman...</div>`;

    try {
      const res = await SmartJApi.post("getDeliveryDetail", { deliveryId });
      if (!res.success) throw new Error(res.message);
      const items = res.detail.items || [];

      tableContainer.innerHTML = `
        <table class="w-full text-left border-collapse">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th class="py-2 px-3">Material</th>
              <th class="py-2 px-3 text-right">Qty Surat Jalan</th>
              <th class="py-2 px-3 text-right">Qty Fisik Diterima</th>
              <th class="py-2 px-3">Catatan Fisik</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${items.map(it => `
              <tr>
                <td class="py-2 px-3 font-semibold">${it.MATERIAL_NAME || it.PO_ITEM_ID}</td>
                <td class="py-2 px-3 text-right">${fmtNumber(it.QTY_SENT)} ${it.UOM}</td>
                <td class="py-2 px-3 text-right">
                  <input type="number" step="any" min="0" value="${it.QTY_SENT}" required
                    data-del-item-id="${it.DELIVERY_ITEM_ID}"
                    class="mrr-qty-rec w-24 px-2 py-1 border border-slate-300 rounded text-right font-bold text-emerald-800" />
                </td>
                <td class="py-2 px-3">
                  <input type="text" data-del-item-rem="${it.DELIVERY_ITEM_ID}" placeholder="Sesuai / catatan..."
                    class="mrr-rem-rec w-full px-2 py-1 border border-slate-300 rounded" />
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } catch (err) {
      tableContainer.innerHTML = `<div class="p-4 text-red-700">${err.message}</div>`;
    }
  });

  document.getElementById("formIssueMRR").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const receivedItems = [];

    document.querySelectorAll(".mrr-qty-rec").forEach(inp => {
      const id = inp.getAttribute("data-del-item-id");
      const remInp = document.querySelector(`.mrr-rem-rec[data-del-item-rem="${id}"]`);
      receivedItems.push({
        deliveryItemId: id,
        qtyReceived: Number(inp.value || 0),
        receivingRemarks: remInp ? remInp.value.trim() : ""
      });
    });

    const btn = document.getElementById("btnSubmitIssueMRR");
    btn.disabled = true;

    try {
      const res = await SmartJApi.post("receivingConfirmArrivalAndIssueMRR", {
        deliveryId: fd.get("deliveryId"),
        notes: fd.get("notes"),
        receivedItems
      });
      if (!res.success) throw new Error(res.message);

      await loadReceivingMRRView(SmartJApi.getUser());
      showInlineBanner("mrrAlertBanner", res.message, "success");
    } catch (err) {
      showInlineBanner("mrrAlertBanner", err.message, "error");
      btn.disabled = false;
    }
  });
}

async function openMRRDetailModal(mrrId) {
  const modal = document.getElementById("mrrDetailModal");
  const body = document.getElementById("mrrModalBody");
  modal.classList.remove("hidden");
  body.innerHTML = `<div class="py-8 text-center text-slate-500">Memuat rincian MRR...</div>`;

  try {
    const res = await SmartJApi.post("getMRRDetail", { mrrId });
    if (!res.success) throw new Error(res.message);
    const { mrr, po, vendor, items } = res.detail;

    document.getElementById("mrrModalTitle").textContent = `MRR: ${mrr.MRR_NUMBER}`;
    body.innerHTML = `
      <div class="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div><span class="text-slate-500 block">Nomor PO</span><strong>${po.PO_NUMBER || "-"}</strong></div>
        <div><span class="text-slate-500 block">Vendor</span><strong>${vendor.VENDOR_NAME || "-"}</strong></div>
        <div><span class="text-slate-500 block">Tanggal Terbit MRR</span><strong>${fmtDate(mrr.MRR_ISSUED_DATETIME)}</strong></div>
        <div><span class="text-slate-500 block">Catatan Receiving</span><strong>${mrr.NOTES || "-"}</strong></div>
      </div>
      <table class="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="py-2 px-3">Material</th>
            <th class="py-2 px-3 text-right">Qty Diterima</th>
            <th class="py-2 px-3">Catatan</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${items.map(it => `
            <tr>
              <td class="py-2 px-3 font-semibold">${it.MATERIAL_NAME || it.PO_ITEM_ID}</td>
              <td class="py-2 px-3 text-right font-bold text-emerald-800">${fmtNumber(it.QTY_RECEIVED)} ${it.UOM}</td>
              <td class="py-2 px-3 text-slate-600">${it.RECEIVING_REMARKS || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    body.innerHTML = `<div class="p-4 bg-red-50 text-red-800 rounded-lg">${err.message}</div>`;
  }
}
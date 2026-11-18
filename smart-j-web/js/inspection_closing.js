/**
 * SMART-J FRONTEND - TAHAP 4 (FINAL)
 * Modul Pemeriksaan Material (Assign Inspector, Input OK/NG per Round, Perbaikan Vendor)
 * & Modul BA Closing (Upload PDF BA Closing oleh Receiving & Download oleh Vendor)
 */

let cachedMRRForInspection = [];
let cachedInspectorsList = [];

function inspectionBadge(result, status) {
  const res = String(result || "PENDING").toUpperCase();
  const st = String(status || "PENDING").toUpperCase();

  if (res === "OK" && st === "CLOSED") {
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">OK (CLOSED)</span>`;
  }
  if (st === "WAITING_VENDOR_CORRECTION") {
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">NG • PERLU PERBAIKAN VENDOR</span>`;
  }
  if (st === "READY_FOR_REINSPECTION") {
    return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">SIAP RE-INSPECTION</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">MENUNGGU PEMERIKSAAN</span>`;
}

// =========================================================================
// VIEW A: MODUL PEMERIKSAAN MATERIAL & SIKLUS PERBAIKAN NG
// =========================================================================
async function loadInspectionView(user) {
  const roleTitles = {
    ADMIN: ["Monitoring & Pemeriksaan Material (QC)", "Kelola penugasan inspector, riwayat hasil OK/NG, dan tindak lanjut perbaikan"],
    RECEIVING: ["Penugasan Inspector & Status QC", "Tugaskan personel QC Inspector untuk setiap MRR yang telah terbit"],
    INSPECTOR: ["Antrian Pemeriksaan Material (QC)", "Input hasil pemeriksaan OK/NG beserta bukti foto per putaran inspeksi"],
    VENDOR: ["Status Pemeriksaan Material & Perbaikan NG", "Pantau hasil pemeriksaan QC dan unggah bukti perbaikan apabila terdapat temuan NG"]
  };
  const [title, sub] = roleTitles[user.role] || roleTitles.VENDOR;
  document.getElementById("pageTitle").textContent = title;
  document.getElementById("pageSubtitle").textContent = sub;

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat antrian dan riwayat pemeriksaan material...</span>
    </div>
  `;

  try {
    const canAssign = ["ADMIN", "RECEIVING", "INSPECTOR"].includes(user.role);
    const reqs = [SmartJApi.post("getMRRList", {})];
    if (canAssign) {
      reqs.push(SmartJApi.post("getInspectors", {}).catch(() => ({ success: false, inspectors: [] })));
    }

    const [mrrRes, inspRes] = await Promise.all(reqs);
    if (!mrrRes.success) throw new Error(mrrRes.message);

    cachedMRRForInspection = mrrRes.mrrList || [];
    cachedInspectorsList = (inspRes && inspRes.success) ? (inspRes.inspectors || []) : [];

    // Jika inspector login tetapi belum masuk daftar dropdown karena fallback, tambahkan dirinya sendiri
    if (user.role === "INSPECTOR" && !cachedInspectorsList.some(i => i.USER_ID === user.userId)) {
      cachedInspectorsList.push({ USER_ID: user.userId, USERNAME: user.username, FULL_NAME: user.fullName });
    }

    const inspMap = {};
    cachedInspectorsList.forEach(i => { inspMap[i.USER_ID] = i.FULL_NAME; });

    container.innerHTML = `
      <div id="inspAlertBanner" class="hidden"></div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-bold text-slate-800">Daftar MRR & Status Pemeriksaan QC (${cachedMRRForInspection.length})</h3>
          <select id="filterInspectionStatus" class="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
            <option value="ALL">Semua Status Pemeriksaan</option>
            <option value="PENDING">Menunggu Pemeriksaan Awal</option>
            <option value="WAITING_VENDOR_CORRECTION">NG - Menunggu Perbaikan Vendor</option>
            <option value="READY_FOR_REINSPECTION">Siap Re-Inspection</option>
            <option value="CLOSED">OK - Selesai (CLOSED)</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Nomor MRR</th>
                <th class="py-3 px-4">No. PO & Vendor</th>
                <th class="py-3 px-4">Inspector Ditugaskan</th>
                <th class="py-3 px-4">Putaran</th>
                <th class="py-3 px-4">Status Pemeriksaan</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody id="inspectionTableBody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
      </div>

      <!-- MODAL RIWAYAT INSPEKSI, PENUGASAN, INPUT OK/NG & PERBAIKAN VENDOR -->
      <div id="inspectionDetailModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 id="inspModalTitle" class="text-base font-bold text-slate-800">Detail Pemeriksaan Material</h3>
            <button type="button" onclick="closeInspectionModal()" class="text-slate-400 hover:text-slate-700 text-lg">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="inspModalBody" class="p-6 text-xs space-y-5"></div>
        </div>
      </div>
    `;

    renderInspectionTable("ALL", user, inspMap);
    document.getElementById("filterInspectionStatus").addEventListener("change", (e) => {
      renderInspectionTable(e.target.value, user, inspMap);
    });
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
  }
}

function renderInspectionTable(filterVal, user, inspMap) {
  const tbody = document.getElementById("inspectionTableBody");
  const filtered = filterVal === "ALL"
    ? cachedMRRForInspection
    : cachedMRRForInspection.filter(m => String(m.LATEST_INSPECTION_STATUS || "PENDING").toUpperCase() === filterVal);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">Tidak ada data MRR pada kategori ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const st = String(m.LATEST_INSPECTION_STATUS || "PENDING").toUpperCase();
    let btnLabel = "Lihat Riwayat QC";
    let btnClass = "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300";

    if (user.role === "VENDOR" && st === "WAITING_VENDOR_CORRECTION") {
      btnLabel = "Upload Perbaikan NG";
      btnClass = "bg-red-600 hover:bg-red-700 text-white border-red-600";
    } else if (["INSPECTOR", "ADMIN"].includes(user.role) && st !== "CLOSED") {
      btnLabel = st === "WAITING_VENDOR_CORRECTION" ? "Menunggu Vendor" : "Periksa / Input Hasil";
      btnClass = "bg-blue-700 hover:bg-blue-800 text-white border-blue-700";
    } else if (user.role === "RECEIVING" && st !== "CLOSED") {
      btnLabel = "Assign Inspector";
      btnClass = "bg-indigo-700 hover:bg-indigo-800 text-white border-indigo-700";
    }

    return `
      <tr class="hover:bg-slate-50">
        <td class="py-3 px-4 font-mono font-bold text-emerald-800">${m.MRR_NUMBER}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-blue-900">${m.PO_NUMBER}</div>
          <div class="text-[11px] text-slate-600">${m.VENDOR_NAME}</div>
        </td>
        <td class="py-3 px-4">
          ${m.INSPECTOR_USER_ID
            ? `<span class="font-semibold text-slate-800">${inspMap[m.INSPECTOR_USER_ID] || m.INSPECTOR_USER_ID}</span>`
            : `<span class="text-slate-400 italic">Belum ditugaskan</span>`}
        </td>
        <td class="py-3 px-4 font-semibold text-slate-700">Round ${m.LATEST_INSPECTION_ROUND || 0}</td>
        <td class="py-3 px-4">${inspectionBadge(m.LATEST_INSPECTION_RESULT, m.LATEST_INSPECTION_STATUS)}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="openInspectionModal('${m.MRR_ID}')"
            class="px-3 py-1.5 rounded-lg font-semibold border transition ${btnClass}">
            ${btnLabel}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function openInspectionModal(mrrId) {
  const modal = document.getElementById("inspectionDetailModal");
  const body = document.getElementById("inspModalBody");
  const user = SmartJApi.getUser();

  modal.classList.remove("hidden");
  body.innerHTML = `<div class="py-10 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat riwayat pemeriksaan...</div>`;

  try {
    const [histRes, mrrDetRes] = await Promise.all([
      SmartJApi.post("getInspectionHistory", { mrrId }),
      SmartJApi.post("getMRRDetail", { mrrId })
    ]);

    if (!histRes.success) throw new Error(histRes.message);

    const { mrr, assignments, inspectionLogs } = histRes;
    const mrrItems = (mrrDetRes.success && mrrDetRes.detail) ? (mrrDetRes.detail.items || []) : [];
    const lastLog = inspectionLogs.length > 0 ? inspectionLogs[inspectionLogs.length - 1] : null;
    const isClosedOK = lastLog && String(lastLog.RESULT).toUpperCase() === "OK" && String(lastLog.STATUS).toUpperCase() === "CLOSED";
    const isWaitingVendor = lastLog && String(lastLog.STATUS).toUpperCase() === "WAITING_VENDOR_CORRECTION";

    const canAssign = ["ADMIN", "RECEIVING", "INSPECTOR"].includes(user.role) && !isClosedOK;
    const canSubmitInspection = ["INSPECTOR", "ADMIN"].includes(user.role) && !isClosedOK && !isWaitingVendor;
    const canSubmitVendorRepair = ["VENDOR", "ADMIN"].includes(user.role) && isWaitingVendor;

    document.getElementById("inspModalTitle").textContent = `Pemeriksaan Material: ${mrr.MRR_NUMBER}`;

    body.innerHTML = `
      <!-- Ringkasan Material pada MRR -->
      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div class="font-bold text-slate-800">Daftar Item Material pada MRR Ini:</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${mrrItems.map(it => `
            <div class="px-3 py-2 bg-white rounded border border-slate-200 flex justify-between items-center">
              <div>
                <div class="font-semibold text-slate-800">${it.MATERIAL_NAME || it.PO_ITEM_ID}</div>
                <div class="text-[11px] text-slate-500">${it.SPECIFICATION || "-"}</div>
              </div>
              <span class="font-bold text-emerald-800">${fmtNumber(it.QTY_RECEIVED)} ${it.UOM}</span>
            </div>
          `).join("")}
        </div>
      </div>

      ${canAssign ? `
      <!-- PANEL PENUGASAN / RE-ASSIGN INSPECTOR -->
      <div class="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
        <h4 class="font-bold text-indigo-950 flex items-center gap-2">
          <i class="fa-solid fa-user-check"></i>
          <span>Penugasan QC Inspector</span>
        </h4>
        <form id="formAssignInspector" class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
          <div class="sm:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Pilih Personel Inspector *</label>
            <select name="inspectorUserId" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">-- Pilih Inspector --</option>
              ${cachedInspectorsList.map(ins => `<option value="${ins.USER_ID}">${ins.FULL_NAME} (${ins.USERNAME})</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Target Tgl Periksa</label>
            <input type="date" name="targetInspectionDate" class="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white" />
          </div>
          <div>
            <button type="submit" class="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded-lg">
              Simpan Tugas
            </button>
          </div>
        </form>
        ${assignments.length > 0 ? `
          <div class="text-[11px] text-indigo-900">
            Penugasan terakhir: <strong>${assignments[assignments.length - 1].INSPECTOR_NAME}</strong> (${assignments[assignments.length - 1].STATUS})
          </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- TIMELINE RIWAYAT PUTARAN INSPEKSI (ANTI-TIMPA) -->
      <div class="space-y-3">
        <h4 class="font-bold text-slate-800">Riwayat Pemeriksaan & Tindak Lanjut (${inspectionLogs.length} Putaran)</h4>
        ${inspectionLogs.length === 0 ? `
          <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-center">
            Belum ada catatan hasil pemeriksaan untuk MRR ini.
          </div>
        ` : inspectionLogs.map(log => {
          const isOk = String(log.RESULT).toUpperCase() === "OK";
          return `
            <div class="p-4 rounded-xl border ${isOk ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"} space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded font-bold ${isOk ? "bg-emerald-700 text-white" : "bg-red-600 text-white"}">
                    ROUND ${log.INSPECTION_ROUND} : ${log.RESULT}
                  </span>
                  <span class="font-semibold text-slate-800">Oleh: ${log.INSPECTOR_NAME}</span>
                </div>
                <span class="text-[11px] text-slate-500">${fmtDate(log.INSPECTION_DATE)} • Status: <strong>${log.STATUS}</strong></span>
              </div>

              <div class="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div><span class="font-semibold text-slate-700">Catatan / Temuan Inspector:</span> ${log.FINDINGS || "-"}</div>
                ${log.NEXT_INSPECTION_TARGET ? `<div><span class="font-semibold text-amber-800">Target Re-Inspection:</span> ${fmtDate(log.NEXT_INSPECTION_TARGET)}</div>` : ""}
                ${log.VENDOR_CORRECTIVE_ACTION ? `
                  <div class="pt-2 mt-2 border-t border-slate-100 text-blue-950">
                    <span class="font-bold text-blue-800 block">Tindakan Perbaikan Vendor (${fmtDate(log.CORRECTION_SUBMITTED_AT)}):</span>
                    ${log.VENDOR_CORRECTIVE_ACTION}
                  </div>
                ` : ""}
              </div>

              ${(log.FILES && log.FILES.length > 0) ? `
                <div class="flex flex-wrap gap-2 pt-1">
                  ${log.FILES.map(f => `
                    <button type="button" onclick="SmartJApi.downloadPrivateFile('${f.DRIVE_FILE_ID}')"
                      class="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[11px] text-slate-800 flex items-center gap-1.5">
                      <i class="fa-solid fa-paperclip text-blue-700"></i>
                      <span>${f.FILE_NAME}</span>
                    </button>
                  `).join("")}
                </div>
              ` : ""}
            </div>
          `;
        }).join("")}
      </div>

      ${canSubmitInspection ? `
      <!-- FORM INPUT HASIL PEMERIKSAAN OLEH INSPECTOR / ADMIN -->
      <div class="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
        <h4 class="font-bold text-blue-950">Input Hasil Pemeriksaan Putaran ke-${inspectionLogs.length + 1}</h4>
        <form id="formSubmitInspection" class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Keputusan Hasil Pemeriksaan *</label>
              <select id="selectInspectionDecision" name="result" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold">
                <option value="OK">OK — Lolos Pemeriksaan (Lanjut BA Closing)</option>
                <option value="NG">NG — Tidak Sesuai (Kembalikan ke Vendor untuk Perbaikan)</option>
              </select>
            </div>
            <div id="nextInspectionTargetWrapper" class="hidden">
              <label class="block font-semibold text-slate-700 mb-1">Target Tanggal Re-Inspection</label>
              <input type="date" name="nextInspectionTarget" class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Catatan Pemeriksaan / Detail Temuan NG *</label>
            <textarea name="findings" rows="2" required placeholder="Tuliskan hasil verifikasi dimensi/visual/sertifikat atau detail ketidaksesuaian..."
              class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"></textarea>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Lampiran Foto / Laporan Inspeksi (Opsional, bisa pilih banyak file)</label>
            <input type="file" id="inspEvidenceFiles" multiple accept="image/*,.pdf"
              class="w-full text-[11px] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-700 file:text-white" />
          </div>

          <button type="submit" id="btnSubmitInspection"
            class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition">
            Simpan Hasil Pemeriksaan Putaran ke-${inspectionLogs.length + 1}
          </button>
        </form>
      </div>
      ` : ""}

      ${canSubmitVendorRepair ? `
      <!-- FORM VENDOR SUBMIT PERBAIKAN ATAS TEMUAN NG -->
      <div class="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
        <h4 class="font-bold text-amber-950">Kirim Tindakan & Bukti Perbaikan (Tindak Lanjut Round ${lastLog.INSPECTION_ROUND})</h4>
        <form id="formVendorRepair" class="space-y-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Uraian Tindakan Perbaikan yang Telah Dilakukan *</label>
            <textarea name="correctiveAction" rows="2" required
              placeholder="Jelaskan perbaikan/penggantian material yang telah dilakukan sesuai catatan inspector..."
              class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"></textarea>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Unggah Foto / Dokumen Bukti Perbaikan (Bisa pilih banyak file)</label>
            <input type="file" id="vendorRepairFiles" multiple accept="image/*,.pdf"
              class="w-full text-[11px] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-amber-700 file:text-white" />
          </div>
          <button type="submit" id="btnSubmitVendorRepair"
            class="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition">
            Kirim Bukti Perbaikan & Ajukan Re-Inspection
          </button>
        </form>
      </div>
      ` : ""}
    `;

    // Bind Assign Inspector
    if (canAssign) {
      document.getElementById("formAssignInspector").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const res = await SmartJApi.post("assignInspector", {
            mrrId,
            inspectorUserId: fd.get("inspectorUserId"),
            targetInspectionDate: fd.get("targetInspectionDate")
          });
          if (!res.success) throw new Error(res.message);
          await openInspectionModal(mrrId);
          await loadInspectionView(user);
          showInlineBanner("inspAlertBanner", res.message, "success");
        } catch (err) {
          alert("Gagal menugaskan inspector: " + err.message);
        }
      });
    }

    // Bind Submit Inspection Result
    if (canSubmitInspection) {
      const decSelect = document.getElementById("selectInspectionDecision");
      const targetWrap = document.getElementById("nextInspectionTargetWrapper");
      decSelect.addEventListener("change", () => {
        targetWrap.classList.toggle("hidden", decSelect.value !== "NG");
      });

      document.getElementById("formSubmitInspection").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btnSubmitInspection");
        btn.disabled = true;
        btn.textContent = "Menyimpan hasil pemeriksaan...";

        try {
          const fd = new FormData(e.target);
          const fileInput = document.getElementById("inspEvidenceFiles");
          const files = [];

          if (fileInput && fileInput.files) {
            for (const f of Array.from(fileInput.files)) {
              if (f.size > 10 * 1024 * 1024) throw new Error(`File "${f.name}" melebihi 10 MB.`);
              const b64 = await SmartJApi.fileToBase64Object(f);
              files.push({ ...b64, description: "Lampiran Pemeriksaan QC" });
            }
          }

          const res = await SmartJApi.post("submitInspectionResult", {
            mrrId,
            result: fd.get("result"),
            findings: fd.get("findings"),
            nextInspectionTarget: fd.get("nextInspectionTarget"),
            files
          });
          if (!res.success) throw new Error(res.message);

          closeInspectionModal();
          await loadInspectionView(user);
          showInlineBanner("inspAlertBanner", res.message, "success");
        } catch (err) {
          alert("Gagal menyimpan hasil pemeriksaan: " + err.message);
          btn.disabled = false;
        }
      });
    }

    // Bind Submit Vendor Correction
    if (canSubmitVendorRepair) {
      document.getElementById("formVendorRepair").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btnSubmitVendorRepair");
        btn.disabled = true;
        btn.textContent = "Mengunggah bukti perbaikan...";

        try {
          const fd = new FormData(e.target);
          const fileInput = document.getElementById("vendorRepairFiles");
          const files = [];

          if (fileInput && fileInput.files) {
            for (const f of Array.from(fileInput.files)) {
              if (f.size > 10 * 1024 * 1024) throw new Error(`File "${f.name}" melebihi 10 MB.`);
              const b64 = await SmartJApi.fileToBase64Object(f);
              files.push({ ...b64, description: "Bukti Perbaikan Vendor" });
            }
          }

          const res = await SmartJApi.post("submitVendorCorrection", {
            inspectionId: lastLog.INSPECTION_ID,
            correctiveAction: fd.get("correctiveAction"),
            files
          });
          if (!res.success) throw new Error(res.message);

          closeInspectionModal();
          await loadInspectionView(user);
          showInlineBanner("inspAlertBanner", res.message, "success");
        } catch (err) {
          alert("Gagal mengirim perbaikan: " + err.message);
          btn.disabled = false;
        }
      });
    }
  } catch (err) {
    body.innerHTML = `<div class="p-4 bg-red-50 text-red-800 rounded-lg">${err.message}</div>`;
  }
}

function closeInspectionModal() {
  document.getElementById("inspectionDetailModal").classList.add("hidden");
}

// =========================================================================
// VIEW B: MODUL BA CLOSING (UPLOAD PDF RECEIVING & DOWNLOAD VENDOR)
// =========================================================================
async function loadClosingView(user) {
  const canUploadBA = ["RECEIVING", "ADMIN"].includes(user.role);
  document.getElementById("pageTitle").textContent = canUploadBA
    ? "Berita Acara (BA) Closing & Arsip PDF"
    : "Dokumen Berita Acara (BA) Closing";
  document.getElementById("pageSubtitle").textContent = canUploadBA
    ? "Unggah dokumen resmi PDF BA Closing untuk material yang telah lolos pemeriksaan (OK)"
    : "Unduh dokumen resmi PDF BA Closing untuk pengiriman Anda yang telah selesai diperiksa";

  const container = document.getElementById("mainContentArea");
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 gap-3">
      <i class="fa-solid fa-spinner fa-spin text-xl text-blue-700"></i>
      <span class="text-sm font-medium">Memuat daftar tiket BA Closing...</span>
    </div>
  `;

  try {
    const res = await SmartJApi.post("getClosingList", {});
    if (!res.success) throw new Error(res.message);

    const closings = res.closings || [];

    container.innerHTML = `
      <div id="closingAlertBanner" class="hidden"></div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-800">Daftar Tiket BA Closing (${closings.length})</h3>
          <span class="text-[11px] text-slate-500">Tiket closing otomatis terbuka setelah pemeriksaan material dinyatakan OK</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th class="py-3 px-4">Nomor MRR</th>
                <th class="py-3 px-4">No. PO & Vendor</th>
                <th class="py-3 px-4">Status Closing</th>
                <th class="py-3 px-4">Dokumen PDF Terakhir</th>
                <th class="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${closings.length === 0 ? `
                <tr><td colspan="5" class="py-8 text-center text-slate-400">
                  Belum ada material yang masuk tahap BA Closing (pastikan hasil pemeriksaan inspector sudah OK).
                </td></tr>
              ` : closings.map(c => {
                const isDone = String(c.STATUS_CLOSING).toUpperCase() === "COMPLETED";
                return `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-4 font-mono font-bold text-emerald-800">${c.MRR_NUMBER}</td>
                    <td class="py-3 px-4">
                      <div class="font-bold text-blue-900">${c.PO_NUMBER}</div>
                      <div class="text-[11px] text-slate-600">${c.VENDOR_NAME}</div>
                    </td>
                    <td class="py-3 px-4">
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isDone ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
                        ${c.STATUS_CLOSING}
                      </span>
                    </td>
                    <td class="py-3 px-4">
                      ${c.LATEST_FILE
                        ? `<span class="font-semibold text-slate-800">${c.LATEST_FILE.DOCUMENT_VERSION} — ${c.LATEST_FILE.FILE_NAME}</span>`
                        : `<span class="text-slate-400 italic">Belum ada PDF diunggah</span>`}
                    </td>
                    <td class="py-3 px-4 text-right">
                      <button onclick="openClosingModal('${c.CLOSING_ID}')"
                        class="px-3 py-1.5 rounded-lg font-semibold border transition ${canUploadBA ? "bg-blue-800 hover:bg-blue-900 text-white border-blue-800" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"}">
                        ${canUploadBA ? "Upload / Kelola PDF" : "Lihat & Unduh PDF"}
                      </button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL DETAIL & UPLOAD PDF BA CLOSING -->
      <div id="closingDetailModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 id="closingModalTitle" class="text-base font-bold text-slate-800">Berita Acara Closing</h3>
            <button type="button" onclick="document.getElementById('closingDetailModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-700 text-lg">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="closingModalBody" class="p-6 text-xs space-y-5"></div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">${err.message}</div>`;
  }
}

async function openClosingModal(closingId) {
  const modal = document.getElementById("closingDetailModal");
  const body = document.getElementById("closingModalBody");
  const user = SmartJApi.getUser();
  const canUploadBA = ["RECEIVING", "ADMIN"].includes(user.role);

  modal.classList.remove("hidden");
  body.innerHTML = `<div class="py-8 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat detail BA Closing...</div>`;

  try {
    const res = await SmartJApi.post("getClosingDetail", { closingId });
    if (!res.success) throw new Error(res.message);

    const { closing, mrr, po, vendor, files } = res.detail;
    document.getElementById("closingModalTitle").textContent = `BA Closing — MRR ${mrr.MRR_NUMBER}`;

    body.innerHTML = `
      <div class="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div><span class="text-slate-500 block">Nomor PO</span><strong>${po.PO_NUMBER || "-"}</strong></div>
        <div><span class="text-slate-500 block">Perusahaan Vendor</span><strong>${vendor.VENDOR_NAME || "-"}</strong></div>
        <div><span class="text-slate-500 block">Status Closing</span><strong>${closing.STATUS_CLOSING}</strong></div>
        <div><span class="text-slate-500 block">Tgl Selesai</span><strong>${fmtDate(closing.CLOSING_COMPLETED_AT)}</strong></div>
      </div>

      <!-- Daftar File PDF BA Closing -->
      <div class="space-y-2">
        <h4 class="font-bold text-slate-800">Arsip Dokumen PDF BA Closing (${files.length})</h4>
        ${files.length === 0 ? `
          <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-center">
            Belum ada file PDF BA Closing yang diunggah.
          </div>
        ` : files.map(f => {
          const isFinal = String(f.IS_FINAL).toUpperCase() === "TRUE";
          return `
            <div class="p-3 rounded-lg border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">${f.DOCUMENT_VERSION}</span>
                  <span class="font-bold text-slate-800">${f.FILE_NAME}</span>
                  ${isFinal ? `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">FINAL</span>` : ""}
                </div>
                <div class="text-[11px] text-slate-500 mt-1">
                  Diunggah: ${fmtDate(f.UPLOAD_DATE)} ${f.REMARKS ? `• Catatan: ${f.REMARKS}` : ""}
                </div>
              </div>
              <button type="button" onclick="SmartJApi.downloadPrivateFile('${f.DRIVE_FILE_ID}')"
                class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1.5">
                <i class="fa-solid fa-file-pdf"></i>
                <span>Unduh PDF</span>
              </button>
            </div>
          `;
        }).join("")}
      </div>

      ${canUploadBA ? `
      <!-- FORM RECEIVING / ADMIN UPLOAD PDF BA CLOSING -->
      <div class="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
        <h4 class="font-bold text-blue-950">Unggah Dokumen PDF BA Closing Baru</h4>
        <form id="formUploadBAClosing" class="space-y-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Pilih File PDF BA Closing (Wajib Format .pdf) *</label>
            <input type="file" id="baClosingPdfInput" accept="application/pdf,.pdf" required
              class="w-full text-[11px] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-800 file:text-white" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Catatan / Keterangan BA Closing</label>
            <input type="text" name="remarks" placeholder="Contoh: BA Closing telah ditandatangani lengkap"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white" />
          </div>
          <label class="flex items-center gap-2 text-slate-800 font-semibold">
            <input type="checkbox" name="isFinal" checked class="rounded text-blue-700" />
            <span>Tandai sebagai BA Closing Final (Status otomatis menjadi COMPLETED)</span>
          </label>
          <button type="submit" id="btnSubmitBAClosing"
            class="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition">
            <i class="fa-solid fa-cloud-arrow-up mr-1"></i>Unggah PDF BA Closing
          </button>
        </form>
      </div>
      ` : ""}
    `;

    if (canUploadBA) {
      document.getElementById("formUploadBAClosing").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btnSubmitBAClosing");
        const pdfInput = document.getElementById("baClosingPdfInput");
        if (!pdfInput.files || pdfInput.files.length === 0) return;

        const pdfFile = pdfInput.files[0];
        if (!pdfFile.name.toLowerCase().endsWith(".pdf") && pdfFile.type !== "application/pdf") {
          alert("File wajib berformat PDF (.pdf).");
          return;
        }
        if (pdfFile.size > 15 * 1024 * 1024) {
          alert("Ukuran file PDF maksimal 15 MB.");
          return;
        }

        btn.disabled = true;
        btn.textContent = "Mengunggah PDF ke Google Drive...";

        try {
          const fd = new FormData(e.target);
          const fileObj = await SmartJApi.fileToBase64Object(pdfFile);
          fileObj.mimeType = "application/pdf";

          const res = await SmartJApi.post("receivingUploadBAClosing", {
            closingId: closing.CLOSING_ID,
            mrrId: mrr.MRR_ID,
            isFinal: fd.get("isFinal") === "on",
            remarks: fd.get("remarks"),
            file: fileObj
          });
          if (!res.success) throw new Error(res.message);

          modal.classList.add("hidden");
          await loadClosingView(user);
          showInlineBanner("closingAlertBanner", res.message, "success");
        } catch (err) {
          alert("Gagal mengunggah PDF BA Closing: " + err.message);
          btn.disabled = false;
        }
      });
    }
  } catch (err) {
    body.innerHTML = `<div class="p-4 bg-red-50 text-red-800 rounded-lg">${err.message}</div>`;
  }
}
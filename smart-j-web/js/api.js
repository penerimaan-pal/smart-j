/**
 * SMART-J API CLIENT & SESSION HELPER
 */
const SmartJApi = {
  getToken() {
    return sessionStorage.getItem(SMARTJ_CONFIG.STORAGE_TOKEN_KEY) || "";
  },

  getUser() {
    const raw = sessionStorage.getItem(SMARTJ_CONFIG.STORAGE_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  saveSession(token, user) {
    sessionStorage.setItem(SMARTJ_CONFIG.STORAGE_TOKEN_KEY, token);
    sessionStorage.setItem(SMARTJ_CONFIG.STORAGE_USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    sessionStorage.removeItem(SMARTJ_CONFIG.STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(SMARTJ_CONFIG.STORAGE_USER_KEY);
  },

  /**
   * Ping endpoint doGet() Apps Script untuk memastikan koneksi API aktif
   */
  async checkHealth() {
    const url = getApiUrl();
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow"
    });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Request POST terstandar ke doPost() Apps Script (Anti-CORS Preflight)
   */
  async post(action, payload = {}, requireToken = true) {
    const url = getApiUrl();
    const bodyData = {
      action: action,
      ...payload
    };

    if (requireToken) {
      const token = this.getToken();
      if (!token) {
        this.clearSession();
        throw new Error("Sesi tidak ditemukan. Silakan login kembali.");
      }
      bodyData.token = token;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      redirect: "follow",
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      throw new Error(`Gagal menghubungi server (${res.status})`);
    }

    const json = await res.json();

    // Jika token kedaluwarsa di server, paksa kembali ke halaman login
    if (!json.success && json.message && json.message.toLowerCase().includes("sesi telah berakhir")) {
      this.clearSession();
      window.location.reload();
    }

    return json;
  },

  /**
   * Helper membaca file input HTML menjadi objek Base64 siap kirim ke Apps Script
   */
  fileToBase64Object(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          base64: base64
        });
      };
      reader.onerror = () => reject(new Error("Gagal membaca file: " + file.name));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Helper mengunduh file privat dari Google Drive via endpoint getPrivateFile
   */
  async downloadPrivateFile(driveFileId) {
    const res = await this.post("getPrivateFile", { driveFileId });
    if (!res.success) {
      throw new Error(res.message || "Gagal mengunduh file.");
    }
    const byteChars = atob(res.base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNums)], { type: res.mimeType });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = res.fileName || "dokumen_smartj";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }
};
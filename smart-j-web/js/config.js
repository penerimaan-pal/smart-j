/**
 * ============================================================================
 * SMART-J — Sistem Monitoring Penerimaan & Pemeriksaan Material
 * @author    Allif Cendikiawan — Quality Engineer
 * @copyright © 2026 Allif Cendikiawan. All Rights Reserved.
 * ============================================================================
 */
const SMARTJ_CONFIG = {
  APP_NAME: "SMART-J",
  APP_SUBTITLE: "Sistem Monitoring Penerimaan & Pemeriksaan Material",
  VERSION: "1.0.0",
  AUTHOR: "Allif Cendikiawan",
  AUTHOR_ROLE: "Quality Engineer",
  COPYRIGHT_YEAR: "2026",
  DEFAULT_API_URL: "https://script.google.com/macros/s/AKfycbwROqPNGWMJuyhZtBBUb_GdlT4wlPbiHrqWm74hs73fE0YQiykRCXbv51wD9pgXVNKG/exec",
  STORAGE_TOKEN_KEY: "smartj_session_token",
  STORAGE_USER_KEY: "smartj_session_user",
  STORAGE_API_OVERRIDE_KEY: "smartj_api_url_override"
};

function getApiUrl() {
  return localStorage.getItem(SMARTJ_CONFIG.STORAGE_API_OVERRIDE_KEY) || SMARTJ_CONFIG.DEFAULT_API_URL;
}
// Konfigurace API base URL
// VĂ˝chozĂ­ lokĂˇlnĂ­ backend:
window.API_BASE_URL = "http://127.0.0.1:8000";

(function applyApiOverride() {
  try {
    const p = new URLSearchParams(window.location.search);
    const override = p.get("api");
    if (override) {
      window.API_BASE_URL = override;
    }
  } catch (e) {
    console.warn("API override nepodaĹ™ilo se naÄŤĂ­st:", e);
  }
  // UkĂˇzat aktuĂˇlnĂ­ hodnotu v UI (pokud existuje element)
  window.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("api-base");
    if (el) el.textContent = window.API_BASE_URL;
  });
})();

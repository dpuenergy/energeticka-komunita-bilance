/* === toggles: isolated module (pricingMode) === */
(() => {
  if (typeof window.FEATURE_TOGGLES !== "undefined" && !window.FEATURE_TOGGLES) return;

  const state = { pricingMode: "uniform" };
  const persistKey = "ekb_toggles_v1";

  try {
    const saved = JSON.parse(localStorage.getItem(persistKey) || "{}");
    Object.assign(state, saved);
  } catch {}

  function save() { try { localStorage.setItem(persistKey, JSON.stringify(state)); } catch {} }

  function applyPricingVisibility() {
    const isUniform = state.pricingMode === "uniform";
    const uniformBox = document.querySelector("#uniform-pricing");
    if (uniformBox) uniformBox.style.display = isUniform ? "" : "none";
    document.querySelectorAll(".per-object-field").forEach(el => el.style.display = isUniform ? "none" : "");
  }

  function hydrate() {
    document.querySelectorAll('.segmented[data-key="pricingMode"] .seg').forEach(btn => {
      const on = btn.dataset.val === state.pricingMode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    applyPricingVisibility();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented .seg");
    if (!btn) return;
    const wrap = btn.closest(".segmented");
    const key = wrap?.dataset?.key;
    if (!key) return;

    wrap.querySelectorAll(".seg").forEach(b => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    state[key] = btn.dataset.val;
    save();
    if (key === "pricingMode") applyPricingVisibility();
  });

  window.addEventListener("DOMContentLoaded", hydrate);
})();

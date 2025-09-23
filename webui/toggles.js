/* migrate legacy pricingMode -> commodityMode */
(() => {
  try {
    const k = "ekb_toggles_v1";
    const st = JSON.parse(localStorage.getItem(k) || "{}");
    if (st.pricingMode && !st.commodityMode) {
      st.commodityMode = st.pricingMode;
      delete st.pricingMode;
      localStorage.setItem(k, JSON.stringify(st));
    }
  } catch {}
})();
/* === toggles: isolated module (commodityMode) === */
(() => {
  if (typeof window.FEATURE_TOGGLES !== "undefined" && !window.FEATURE_TOGGLES) return;

  const state = { commodityMode: "uniform" };
  const persistKey = "ekb_toggles_v1";

  try {
    const saved = JSON.parse(localStorage.getItem(persistKey) || "{}");
    Object.assign(state, saved);
  } catch {}

  function save() { try { localStorage.setItem(persistKey, JSON.stringify(state)); } catch {} }

  function applyCommodityVisibility() {
    const isUniform = state.commodityMode === "uniform";
    const uniformBox = document.querySelector("#uniform-pricing");
    if (uniformBox) uniformBox.style.display = isUniform ? "" : "none";
    document.querySelectorAll(".per-object-field").forEach(el => el.style.display = isUniform ? "none" : "");
  }

  function hydrate() {
    document.querySelectorAll('.segmented[data-key="commodityMode"] .seg').forEach(btn => {
      const on = btn.dataset.val === state.commodityMode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    applyCommodityVisibility();
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
    if (key === "commodityMode") applyCommodityVisibility();
  });

  window.addEventListener("DOMContentLoaded", hydrate);
})();
/* --- dedupe segmented toggles (keep first per key) --- */
(() => {
  function dedupe(keys) {
    keys.forEach(key => {
      const nodes = document.querySelectorAll('.segmented[data-key="'+key+'"]');
      if (nodes.length>1){ nodes.forEach((n,i)=>{ if(n.dataset.key==="commodityMode" && i===0) return; if(i>0) n.remove(); }); }
    });
  }
  window.addEventListener("DOMContentLoaded", () => {
    dedupe(["commodityMode","distributionMode","feedinMode"]);
  });
})();
/* --- allowlist guard: keep only segmented with data-ekb-allowed="1" --- */
(() => {
  function pruneUnallowed(root=document){
    root.querySelectorAll(".segmented").forEach(el=>{
      if (el.getAttribute("data-ekb-allowed") !== "1") el.remove();
    });
  }
  if (document.readyState !== "loading") pruneUnallowed();
  else window.addEventListener("DOMContentLoaded", pruneUnallowed);

  // kdyby něco přibylo runtime
  const mo = new MutationObserver(muts=>{
    for (const m of muts) { if (m.addedNodes?.length) { pruneUnallowed(); break; } }
  });
  mo.observe(document.documentElement, { childList:true, subtree:true });
})();
/* debug: log segmented keys after prune/dedupe */
(() => {
  function logSeg(where){
    const arr=[...document.querySelectorAll(".segmented")].map(el=>el.dataset.key||"(no-key)");
    console.log("[segmented:"+where+"]", arr);
  }
  document.addEventListener("DOMContentLoaded", ()=>logSeg("DOMContentLoaded"));
  setTimeout(()=>logSeg("after 500ms"), 500);
})();

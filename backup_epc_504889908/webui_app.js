// === TÉMA / BARVY (laděno na dpuenergy.cz – modrá/tyrkys) ===
// Pozn.: snadná úprava v CSS: .text-brand-600, .bg-brand-*, .border-brand-*

// === API WRAPPER (ponecháno z předchozí verze) ===
const API = (() => {
  const base = () => window.API_BASE_URL?.replace(/\/$/, "") || "";
  const headersJson = { "Content-Type": "application/json" };
  async function handle(r) {
    if (!r.ok) {
      let bodyText = ""; try { bodyText = await r.text(); } catch {}
      throw new Error(bodyText || r.statusText || "Chyba požadavku");
    }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return r.json();
    return r.text();
  }
  async function upload(key, file) {
    const url = base() + "/api/upload";
    const fd = new FormData(); fd.append("key", key); fd.append("file", file);
    const r = await fetch(url, { method: "POST", body: fd }); return handle(r);
  }
  async function runStep(step, params) {
    const url = base() + "/api/run/" + encodeURIComponent(step);
    const r = await fetch(url, { method: "POST", headers: headersJson, body: JSON.stringify(params) });
    return handle(r);
  }
  async function listOutputs(){ return handle(await fetch(base()+"/api/outputs")); }
  async function summaryStep3(){ return handle(await fetch(base()+"/api/summary/step3")); }
  function downloadUrl(name){ return base()+"/api/outputs/"+encodeURIComponent(name); }
  return { upload, runStep, listOutputs, summaryStep3, downloadUrl };
})();

// === STAV A LOKÁLNÍ DATOVÝ MODEL ===
const state = {
  commodityMode: "uniform",
  distributionMode: "uniform",
  feedinMode: "uniform",
  objects: [],
  editIndex: null,
};

// === UI HELPERS ===
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function toast(msg, type="info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(()=>el.remove(), 300); }, 4000);
}

function updateUniformVisibility() {
  const show = state.commodityMode==="uniform" && state.distributionMode==="uniform" && state.feedinMode==="uniform";
  qs("#uniform-pricing").classList.toggle("hidden", !show);
  qsa(".per-object-field").forEach(el => el.classList.toggle("hidden", show));
}

function renderObjects() {
  const tb = qs("#objects-tbody");
  tb.innerHTML = "";
  if (!state.objects.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 14;
    td.className = "px-4 py-6 text-center text-slate-500";
    td.textContent = "Zatím žádné objekty.";
    tr.appendChild(td); tb.appendChild(tr); return;
  }
  state.objects.forEach((o, idx) => {
    const tr = document.createElement("tr");
    function cell(txt){ const td=document.createElement("td"); td.className="td"; td.textContent=txt??""; return td; }

    tr.appendChild(cell(o.name));
    tr.appendChild(cell(o.annualCons ?? ""));
    tr.appendChild(cell(o.annualGen ?? ""));
    tr.appendChild(cell(o.priceComm ?? (state.commodityMode==="uniform" ? "– (uniform)" : "")));
    tr.appendChild(cell(o.distMode==="tariff" ? "dle sazby" : (o.priceDist ?? (state.distributionMode==="uniform"?"– (uniform)":""))));
    tr.appendChild(cell(o.distMode==="tariff" ? (o.tariff || "") : ""));
    tr.appendChild(cell(o.priceFeedin ?? (state.feedinMode==="uniform" ? "– (uniform)" : "")));
    tr.appendChild(cell(o.fveKwP ?? ""));
    tr.appendChild(cell(o.kgjKwe ?? ""));
    tr.appendChild(cell(o.batKwh ?? ""));
    tr.appendChild(cell(o.tuvM3 ?? ""));
    tr.appendChild(cell(o.hasSeriesCons ? "ano" : "ne"));
    tr.appendChild(cell(o.hasSeriesGen ? "ano" : "ne"));

    const tdActions = document.createElement("td"); tdActions.className="td";
    const editBtn = document.createElement("button"); editBtn.className="btn-ghost text-brand-700"; editBtn.textContent="Upravit";
    editBtn.onclick = () => openObjectPanel(idx);
    const delBtn = document.createElement("button"); delBtn.className="btn-ghost text-red-700"; delBtn.textContent="Smazat";
    delBtn.onclick = () => { state.objects.splice(idx,1); renderObjects(); };
    tdActions.appendChild(editBtn); tdActions.appendChild(document.createTextNode(" ")); tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    tb.appendChild(tr);
  });
}

function openObjectPanel(idx=null) {
  state.editIndex = idx;
  const panel = qs("#object-panel");
  panel.classList.remove("hidden");

  const o = (idx!=null) ? state.objects[idx] : {};
  qs("#obj-name").value = o.name || "";
  qs("#obj-annual-cons").value = o.annualCons || "";
  qs("#obj-has-series-cons").checked = !!o.hasSeriesCons;
  qs("#obj-fve").value = o.fveKwP || "";
  qs("#obj-kgj").value = o.kgjKwe || "";
  qs("#obj-bat").value = o.batKwh || "";
  qs("#obj-tuv").value = o.tuvM3 || "";
  qs("#obj-price-comm").value = o.priceComm || "";
  qs("#obj-dist-mode").value = o.distMode || "unit";
  qs("#obj-price-feedin").value = o.priceFeedin || "";

  qs("#obj-save").textContent = (idx!=null) ? "Uložit změny" : "Přidat objekt";
}

function closeObjectPanel(){ qs("#object-panel").classList.add("hidden"); }

function collectObjectFromForm() {
  const o = {
    name: qs("#obj-name").value.trim(),
    annualCons: numberOrNull(qs("#obj-annual-cons").value),
    hasSeriesCons: qs("#obj-has-series-cons").checked,
    fveKwP: numberOrNull(qs("#obj-fve").value),
    kgjKwe: numberOrNull(qs("#obj-kgj").value),
    batKwh: numberOrNull(qs("#obj-bat").value),
    tuvM3: numberOrNull(qs("#obj-tuv").value),
    priceComm: perObjEnabled('commodity') ? numberOrNull(qs("#obj-price-comm").value) : null,
    distMode: perObjEnabled('distribution') ? qs("#obj-dist-mode").value : "unit",
    priceDist: null,
    tariff: null,
    priceFeedin: perObjEnabled('feedin') ? numberOrNull(qs("#obj-price-feedin").value) : null,
    hasSeriesGen: false, // placeholder
  };
  return o;
}

function numberOrNull(v){ const n=Number(v); return isNaN(n)?null:n; }
function perObjEnabled(kind){
  if (kind==="commodity") return state.commodityMode==="per-object";
  if (kind==="distribution") return state.distributionMode==="per-object";
  if (kind==="feedin") return state.feedinMode==="per-object";
  return false;
}

// === BĚH STEP 3 (zatím) ===
async function runStep13() {
  const params = {
    outdir: "out",
    price_commodity_mwh: Number(qs("#price_commodity_mwh").value || 2200),
    price_distribution_mwh: Number(qs("#price_distribution_mwh").value || 1800),
    price_feed_in_mwh: Number(qs("#price_feed_in_mwh").value || 1200),
    mode: qs("#mode").value || "hybrid",
    max_recipients: Number(qs("#max_recipients").value || 3),
  };
  const msg = qs("#run-msg");
  msg.textContent = "Spouštím step 3…";
  const btn = qs("#btn-run-step13"); btn.disabled = true; btn.classList.add("opacity-60","cursor-not-allowed");
  try {
    const res = await API.runStep("step3", params);
    if (res?.ok) { msg.textContent = "Hotovo: OK. Otevři Výstupy. "; }
    else { msg.textContent = "Běh skončil s chybou. " + (res?.return_code ?? ""); }
  } catch (e) {
    msg.textContent = "Chyba: " + (e?.message || e);
  } finally {
    btn.disabled = false; btn.classList.remove("opacity-60","cursor-not-allowed");
  }
}

// === BUILD INFO ===
async function showBuildInfo() {
  try {
    const r = await fetch("./build-info.json", { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    const el = document.getElementById("build-info");
    if (el && data.commit) el.textContent = `build ${data.commit.substring(0,7)} · ${data.date}`;
  } catch {}
}

// === INIT ===
window.addEventListener("DOMContentLoaded", () => {
  // segmented controls
  qsa(".segmented").forEach(seg => {
    seg.addEventListener("click", e => {
      const btn = e.target.closest(".seg"); if (!btn) return;
      seg.querySelectorAll(".seg").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      state[seg.dataset.key] = btn.dataset.val;
      updateUniformVisibility();
    });
  });

  updateUniformVisibility();
  renderObjects();

  // add object button
  qs("#btn-add-object")?.addEventListener("click", ()=> openObjectPanel(null));
  qs("#obj-cancel")?.addEventListener("click", ()=> closeObjectPanel());
  qs("#obj-save")?.addEventListener("click", ()=> {
    const o = collectObjectFromForm();
    if (!o.name) { toast("Zadej název objektu","warn"); return; }
    if (state.editIndex!=null) { state.objects[state.editIndex]=o; }
    else { state.objects.push(o); }
    closeObjectPanel(); renderObjects();
  });

  qs("#btn-run-step13")?.addEventListener("click", runStep13);
  showBuildInfo();
});
// === Toggle: Komoditní složka ===
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("commodityToggle");
  if (!toggle) return;

  toggle.addEventListener("change", () => {
    const sharedField = document.getElementById("shared-commodity-price");
    const perObjectFields = document.querySelectorAll(".commodity-price-per-object");

    if (toggle.checked) {
      // režim: všichni stejná cena
      if (sharedField) sharedField.style.display = "block";
      perObjectFields.forEach(f => f.style.display = "none");
    } else {
      // režim: každé OM vlastní cena
      if (sharedField) sharedField.style.display = "none";
      perObjectFields.forEach(f => f.style.display = "block");
    }
  });

  // vyvoláme při startu
  toggle.dispatchEvent(new Event("change"));
});

function setupToggle(toggleId, sharedId, perObjectClass) {
  const toggle = document.getElementById(toggleId);
  const shared = document.getElementById(sharedId);
  const perObjects = document.querySelectorAll("." + perObjectClass);

  if (!toggle || !shared || perObjects.length === 0) return;

  function applyState() {
    if (toggle.checked) {
      shared.disabled = false;
      perObjects.forEach(el => {
        el.disabled = true;
        el.value = shared.value; // přenes hodnotu
      });
    } else {
      shared.disabled = true;
      perObjects.forEach(el => el.disabled = false);
    }
  }

  toggle.addEventListener("change", applyState);
  shared.addEventListener("input", () => {
    if (toggle.checked) {
      perObjects.forEach(el => el.value = shared.value);
    }
  });

  // init při načtení stránky
  applyState();
}

document.addEventListener("DOMContentLoaded", () => {
  setupToggle("commodityToggle", "shared-commodity-price", "commodity-price-per-object");
  setupToggle("distributionToggle", "shared-distribution-price", "distribution-price-per-object");
  setupToggle("excessToggle", "shared-excess-price", "excess-price-per-object");
});

(function(){
  function bindToggleColor(id){
    const input = document.getElementById(id);
    if(!input) return;
    const labelText = input.closest('.field')?.querySelector('.toggle-text');
    if(!labelText) return;
    function apply(){ labelText.style.color = input.checked ? '#111827' : '#6b7280'; }
    input.addEventListener('change', apply);
    apply();
  }
  document.addEventListener('DOMContentLoaded', () => {
    bindToggleColor('commodityToggle');
    bindToggleColor('distributionToggle');
    bindToggleColor('excessToggle');
  });
})();

(function(){
  function bindToggleClass(id){
    const input = document.getElementById(id);
    if(!input) return;
    const field = input.closest('.field');
    if(!field) return;
    function apply(){ field.classList.toggle('on', !!input.checked); }
    input.addEventListener('change', apply);
    apply();
  }
  document.addEventListener('DOMContentLoaded', () => {
    bindToggleClass('commodityToggle');
    bindToggleClass('distributionToggle');
    bindToggleClass('excessToggle');
  });
})();

/* === EPC toggles: insert + bind === */
(function(){
  const MAP = [
    { id: 'commodityToggle',    re: /(Komoditní\s+složka)/i, shared:'#shared-commodity-price',   per:'.commodity-price-per-object' },
    { id: 'distributionToggle', re: /(Distribuční\s+složka)/i, shared:'#shared-distribution-price', per:'.distribution-price-per-object' },
    { id: 'excessToggle',       re: /((Cena|Prodej)\s+přetoků)/i, shared:'#shared-excess-price',    per:'.excess-price-per-object' },
  ];

  function findByText(regex){
    const candidates = document.querySelectorAll('h1,h2,h3,h4,label,div,span,p,th,td');
    for (const el of candidates){
      const t = (el.textContent || '').trim();
      if (t && regex.test(t)) return el;
    }
    return null;
  }

  function placeEpcToggles(){
    const staging = document.getElementById('toggles-staging');
    if(!staging) return;
    MAP.forEach(m=>{
      const input = document.getElementById(m.id);
      const field = input ? input.closest('.field') : null;
      if(!input || !field) return;
      if (field.dataset.mounted === '1') return;
      const target = findByText(m.re);
      if (target && target.parentNode){
        field.style.display = ''; // show
        target.parentNode.insertBefore(field, target);
        field.dataset.mounted = '1';
      } else {
        // nech ve stagingu, pořád skryté; zkusíme znovu přes MutationObserver
      }
    });
  }

  function bindToggle(id, cfg){
    const checkbox = document.getElementById(id);
    if(!checkbox) return;
    const field = checkbox.closest('.field');

    function propagate(sharedSel, perSel){
      const shared = document.querySelector(sharedSel);
      if(!shared) return;
      const list = Array.from(document.querySelectorAll(perSel));
      list.forEach(i=>{
        i.value = shared.value;
        i.dispatchEvent(new Event('input', {bubbles:true}));
        i.dispatchEvent(new Event('change', {bubbles:true}));
      });
    }

    function apply(){
      const on = !!checkbox.checked;
      if(field) field.classList.toggle('on', on);
      const shared = document.querySelector(cfg.shared);
      const per = Array.from(document.querySelectorAll(cfg.per));

      if (on){
        if(shared){ shared.disabled = false; }
        per.forEach(i=>{ i.disabled = true; });
        if(shared){ propagate(cfg.shared, cfg.per); }
      } else {
        if(shared){ shared.disabled = true; }
        per.forEach(i=>{ i.disabled = false; });
      }
    }

    checkbox.addEventListener('change', apply);
    // init (OFF => shared disabled, individuální povolena)
    apply();

    // když se mění shared hodnota a ON, kopíruj do per-object
    const shared = document.querySelector(cfg.shared);
    if(shared){
      shared.addEventListener('input', ()=>{ if(checkbox.checked) propagate(cfg.shared, cfg.per); });
      shared.addEventListener('change', ()=>{ if(checkbox.checked) propagate(cfg.shared, cfg.per); });
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    placeEpcToggles();
    // Kdyby UI bylo generované později JSem, sleduj DOM a zkoušej umístění znovu
    const mo = new MutationObserver(()=>placeEpcToggles());
    mo.observe(document.body, {childList:true, subtree:true});

    MAP.forEach(m=> bindToggle(m.id, {shared:m.shared, per:m.per}));
  });
})();
 /* === /EPC toggles === */

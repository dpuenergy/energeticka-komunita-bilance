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

    });
  });


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
/* --- KROK2 logic: toggles + object panel --- */
(() => {
  const stKey = "ekb_toggles_v1";
  let st = { commodityMode: "uniform", distributionMode: "uniform", feedinMode: "uniform" };
  try { Object.assign(st, JSON.parse(localStorage.getItem(stKey)||"{}")); } catch {}
  const save = () => { try { localStorage.setItem(stKey, JSON.stringify(st)); } catch {} };

  function applyCommodity(){
    const uni = st.commodityMode === "uniform";
    const box = document.querySelector("#uniform-pricing");
    if (box) box.style.display = uni ? "" : "none";
    document.querySelectorAll(".per-object-field").forEach(el => el.style.display = uni ? "none" : "");
  }
  function applyFeedin(){
    const uni = st.feedinMode === "uniform";
    document.querySelectorAll(".per-object-feedin").forEach(el => el.style.display = uni ? "none" : "");
  }
  function applyDistribution(){
    const isUnit = (st.distributionMode === "uniform" || st.distributionMode === "unit");
    document.querySelectorAll(".when-dist-unit").forEach(el => el.style.display = isUnit ? "" : "none");
    document.querySelectorAll(".when-dist-tariff").forEach(el => el.style.display = isUnit ? "none" : "");
  }

  function hydrateToggles(){
    document.querySelectorAll(".segmented .seg").forEach(btn=>{
      const wrap = btn.closest(".segmented"); const key = wrap?.dataset?.key;
      if (!key) return;
      const on = btn.dataset.val === st[key];
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true":"false");
    });
  }

  function applyObjectPanel(){
    const hasSeries = document.getElementById("obj-has-series-cons")?.checked;
    const annual = document.getElementById("obj-annual-cons");
    if (annual) { annual.disabled = !!hasSeries; annual.classList.toggle("opacity-60", !!hasSeries); }
    document.querySelectorAll(".when-series").forEach(el => el.closest("div")?.classList?.toggle("hidden", !hasSeries));

    const hasGen = document.getElementById("obj-has-gen")?.checked;
    document.querySelectorAll(".obj-gen").forEach(el => el.style.display = hasGen ? "" : "none");

    const hasAcc = document.getElementById("obj-has-acc")?.checked;
    document.querySelectorAll(".obj-acc").forEach(el => el.style.display = hasAcc ? "" : "none");
  }

  function wireMonthlyPanel(){
    const btn = document.getElementById("btn-monthly-panel");
    const panel = document.getElementById("obj-monthly-panel");
    if (!btn || !panel) return;
    btn.addEventListener("click", ()=>{
      const hide = !panel.classList.contains("hidden") && panel.getAttribute("aria-hidden")!=="true";
      panel.classList.toggle("hidden", hide);
      panel.setAttribute("aria-hidden", hide ? "true":"false");
    });
  }

  document.addEventListener("click", (e)=>{
    const btn = e.target.closest(".segmented .seg");
    if (btn){
      const wrap = btn.closest(".segmented"); const key = wrap?.dataset?.key;
      if (key){
        wrap.querySelectorAll(".seg").forEach(b=>{ const on=b===btn; b.classList.toggle("active",on); b.setAttribute("aria-selected",on?"true":"false"); });
        st[key] = btn.dataset.val; save();
        if (key==="commodityMode") applyCommodity();
        if (key==="feedinMode")     applyFeedin();
        if (key==="distributionMode")applyDistribution();
      }
    }
  });

  document.addEventListener("change", (e)=>{
    if (e.target.matches("#obj-has-series-cons,#obj-has-gen,#obj-has-acc")) applyObjectPanel();
    if (e.target.matches("#obj-dist-mode")) {
      const v = e.target.value;
      st.distributionMode = (v==="tariff" ? "tariff" : "unit");
      save(); applyDistribution();
    }
  });

  window.addEventListener("DOMContentLoaded", ()=>{
    hydrateToggles();
    applyCommodity(); applyFeedin(); applyDistribution();
    applyObjectPanel(); wireMonthlyPanel();
  });
})();
/* ~~ neutralized: ROW-SCOPED PRICING TOGGLES (runtime) ~~ */
}

    seg.addEventListener('click', (e)=>{
      const btn = e.target.closest('.seg');
      if(!btn) return;
      modes[scope] = btn.dataset.val || 'uniform';
      save();
      apply();
    });
    if(!modes[scope]) { modes[scope] = 'uniform'; save(); }
    apply();
  }

  function setup(){
    const labels = [...document.querySelectorAll('label')];
    LABELS.forEach(cfg=>{
      const lab = labels.find(l => (l.textContent||'').trim().startsWith(cfg.text));
      if(!lab) return;
      const inp = findInputAfter(lab);
      if(!inp) return;

      // už zabaleno? přeskoč
      if(lab.closest('.price-row[data-scope="'+cfg.scope+'"]')) return;

      // kontejner
      const row = mk('<div class="price-row" data-scope="'+cfg.scope+'"></div>');
      const seg = mk(
        '<div class="segmented" data-key="'+cfg.scope+'">'+
          '<button class="seg" data-val="uniform" aria-selected="true">Všechna OM stejná cena</button>'+
          '<button class="seg" data-val="per-object" aria-selected="false">Každé OM vlastní cena</button>'+
        '</div>'
      );
      const uni = mk('<div class="uniform-only"></div>');
      const per = mk('<div class="per-object-only" style="display:none"><!-- TODO: per-object --></div>');

      // přesuň label+input do uniform části
      if(!inp.id) inp.id = cfg.id;
      uni.appendChild(lab);
      uni.appendChild(inp);

      // vlož do DOM
      const host = uni.parentNode || row; // safeguard
      (host || document.body);
      const anchor = uni.querySelector('label') || lab;
      const where = anchor.parentElement;
      where.insertBefore(row, where.contains(lab) ? lab : where.firstChild);
      row.appendChild(seg); row.appendChild(uni); row.appendChild(per);

      wireRow(row, cfg.scope);
    });
  }

  window.addEventListener('DOMContentLoaded', setup);
})();
/* ~~ neutralized: ROW-SCOPED PRICING TOGGLES (runtime v2) ~~ */
}
    seg.addEventListener("click", (e)=>{
      const btn = e.target.closest(".seg");
      if(!btn) return;
      modes[scope] = btn.dataset.val || "uniform";
      save();
      apply();
    });
    if(!modes[scope]) { modes[scope] = "uniform"; save(); }
    apply();
  }

  function buildRowFromLabel(cfg, lab){
    const inp = findInputAfter(lab);
    if(!inp) return null;
    if(!inp.id) inp.id = cfg.id;

    const row = mk('<div class="price-row" data-scope="'+cfg.scope+'"></div>');
    // vlož řádek těsně před label do DOM
    const host = lab.parentElement || document.body;
    host.insertBefore(row, lab);

    const seg = ensureSeg(row, cfg.scope);
    const {uni, per} = ensureContainers(row);

    // přesuneme label+input do uniform části
    uni.appendChild(lab);
    uni.appendChild(inp);

    // placeholder pro per-object necháme prázdný (doplní se později UI)
    wireRow(row, cfg.scope);
    return row;
  }

  function setup(){
    CFG.forEach(cfg=>{
      let row = document.querySelector('.price-row[data-scope="'+cfg.scope+'"]');
      if(!row){
        const lab = findLabel(cfg);
        if(lab) row = buildRowFromLabel(cfg, lab);
      }
      if(row){
        // kdyby už řádek byl, ale chyběly prvky, doplníme a zapojíme
        wireRow(row, cfg.scope);
      }
    });
  }

  window.addEventListener("DOMContentLoaded", setup);
})();
/* ~~ neutralized: ROW-SCOPED MAPPER (per-row control for common price fields) ~~ */
// 2) načti stav z původního localStorage (pokud existuje)
    let st = {};
    try { st = JSON.parse(localStorage.getItem("ekb_toggles_v1") || "{}"); } catch {}

    // 3) inicializace – aplikuj mód na každý řádek
    MAP.forEach(cfg => {
      const mode = (st[cfg.key] || "uniform");
      apply(cfg.scope, mode);
    });

    // 4) kliky na segmented – přepočítej jen ten daný řádek
    document.addEventListener("click", (e)=>{
      const btn = e.target.closest(".segmented .seg");
      if(!btn) return;
      const wrap = btn.closest(".segmented");
      const key = wrap && wrap.dataset ? wrap.dataset.key : null;
      const cfg = MAP.find(c => c.key === key);
      if(!cfg) return;
      const mode = btn.dataset.val || "uniform";
      apply(cfg.scope, mode);
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
/* ~~ neutralized: ROW-BASED UNIFORM LOGIC ~~ */
}

  document.addEventListener("click", e=>{
    const btn = e.target.closest(".segmented .seg");
    if(!btn) return;
    const wrap = btn.closest(".segmented");
    const key = wrap?.dataset?.key;
    if(!key) return;
    const mode = btn.dataset.val || "uniform";
    apply(key, mode);
  });

  window.addEventListener("DOMContentLoaded", init);
})();
/* ~~ neutralized: ROW-BASED UNIFORM LOGIC (final) ~~ */
if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
/* ~~ neutralized: ROW-SCOPED UNIFORM VISIBILITY (no DOM moves) ~~ */
if(Object.keys(modes).length===0){
      try{ const st = JSON.parse(localStorage.getItem('ekb_toggles_v1')||'{}');
           ['commodityMode','distributionMode','feedinMode'].forEach(k=>modes[k]=st[k]||'uniform'); }catch{}
    }

    let anyUniform=false;
    Object.entries(MAP).forEach(([key,id])=>{
      const mode = modes[key] || 'uniform';
      if(mode==='uniform') anyUniform=true;
      const {inp, lab} = pair(id);
      if(inp){ inp.style.display = (mode==='per-object')?'none':''; }
      if(lab){ lab.style.display = (mode==='per-object')?'none':''; }
    });

    const box = document.getElementById('uniform-pricing');
    if(box){
      // ukázat jen když aspoň jeden řádek je uniform
      box.style.display = anyUniform ? '' : 'none';
    }
  }

  // Hook na kliky přepínačů
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.segmented .seg')) return;
    setTimeout(applyAll, 0);
  });

  // Init po načtení i hned (když už je načteno)
  if(document.readyState==='loading'){
    window.addEventListener('DOMContentLoaded', applyAll);
  } else { applyAll(); }
})();
/* === UNIFORM BLOCKS VISIBILITY (safe minimal) === */
(()=>{
  const MAP={ commodityMode:"uniform-commodity", distributionMode:"uniform-distribution", feedinMode:"uniform-feedin" };

  function readState(){
    try{ return JSON.parse(localStorage.getItem("ekb_toggles_v1")||"{}"); }catch{ return {}; }
  }
  function writeState(st){
    try{ localStorage.setItem("ekb_toggles_v1", JSON.stringify(st)); }catch{}
  }

  function applyAll(){
    const st=readState();
    Object.entries(MAP).forEach(([key,id])=>{
      const el=document.getElementById(id); if(!el) return;
      const mode = st[key] || "uniform";
      el.style.display = (mode==="per-object") ? "none" : "";
    });
  }

  document.addEventListener("click", (e)=>{
    const btn = e.target.closest(".segmented .seg"); if(!btn) return;
    const wrap = btn.closest(".segmented"); const key = wrap?.dataset?.key; if(!key) return;
    const st=readState(); st[key]=btn.dataset.val||"uniform"; writeState(st);
    applyAll();
  });

  if(document.readyState==="loading"){ window.addEventListener("DOMContentLoaded", applyAll); } else { applyAll(); }
})();

/* === PRICE-LINE LAYOUT (final, stable) ==============================
   - Vždy 1 sloupec (komodita → distribuce → přetoky)
   - Každý řádek: [segmented | input | "Kč/MWh"] v JEDNOM kontejneru
   - Inputy formátované česky: tisíce mezerou, 2 desetinná místa čárkou
==================================================================== */
(function(){
  const MAP = [
    { key:'commodityMode',    id:'price-commodity',    title:'Jednotková cena komodity'   },
    { key:'distributionMode', id:'price-distribution', title:'Jednotková cena distribuce' },
    { key:'feedinMode',       id:'price-feedin',       title:'Jednotková cena přetoků'    },
  ];
  const mk = h => { const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; };
  const fmt = new Intl.NumberFormat('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2});
  const parseCZ = s => { const c=String(s??'').replace(/\s|\u00A0/g,'').replace(',', '.').replace(/[^0-9.+-]/g,''); const n=parseFloat(c); return isFinite(n)?n:NaN; };
  const move = (el,to)=>{ if(el && to && !to.contains(el) && el.parentElement!==to && !el.contains(to)) to.appendChild(el); };

  function forceOneColumn(){
    const seg = document.querySelector('.segmented[data-key="commodityMode"], .segmented[data-key="distributionMode"], .segmented[data-key="feedinMode"]');
    const container = seg?.closest('.grid'); if(!container) return;
    container.classList.remove('md:grid-cols-2','grid-cols-2','lg:grid-cols-2','md:grid-cols-3','grid-cols-3');
    container.classList.add('grid-cols-1','md:grid-cols-1');
    ['commodityMode','distributionMode','feedinMode'].forEach(k=>{
      const s = document.querySelector(`.segmented[data-key="${k}"]`)?.closest('.setting');
      if (s && s.parentElement===container) container.appendChild(s);
    });
  }

  function ensureRow(setting, after){
    let row = setting.querySelector(':scope > .price-line');
    if(!row){ row = mk('<div class="price-line"></div>'); setting.insertBefore(row, after?.nextSibling || setting.firstChild); }
    Object.assign(row.style,{ display:'grid', gridTemplateColumns:'max-content 12ch max-content', alignItems:'center', gap:'.75rem', marginTop:'.5rem' });
    const cell = cls => row.querySelector(':scope > .'+cls) || row.appendChild(mk('<div class="'+cls+'"></div>'));
    const seg = cell('col-seg'), inp = cell('col-inp'), lab = cell('col-lab');
    if (row.children[0]!==seg || row.children[1]!==inp || row.children[2]!==lab){ const els=[seg,inp,lab]; row.innerHTML=''; els.forEach(e=>row.appendChild(e)); }
    return {row,seg,inp,lab};
  }

  function apply(){
    forceOneColumn();
    MAP.forEach(({key,id,title})=>{
      const seg = document.querySelector(`.segmented[data-key="${key}"]`);
      const setting = seg?.closest('.setting'); if(!seg || !setting) return;
      const titleEl = setting.querySelector('.setting-title'); if(titleEl) titleEl.textContent = title;
      const {row,seg:colSeg,inp:colInp,lab:colLab} = ensureRow(setting, titleEl);

      move(seg, colSeg);
      Object.assign(seg.style, { display:'inline-flex', flexDirection:'row', flexWrap:'nowrap', gap:'0.5rem', width:'max-content' });
      seg.classList.remove('flex-col');
      seg.querySelectorAll('button.seg').forEach(b=> b.style.whiteSpace='nowrap');

      const input = document.getElementById(id);
      if(input){
        move(input, colInp);
        input.type='text'; input.setAttribute('inputmode','decimal');
        Object.assign(input.style,{ width:'12ch', maxWidth:'12ch', textAlign:'right' });
        if(!input.dataset.fmtBound){
          const n0 = parseCZ(input.value); if(!isNaN(n0)) input.value = fmt.format(n0);
          input.addEventListener('blur', ()=>{ const n=parseCZ(input.value); input.value = isNaN(n)?'':fmt.format(n); });
          input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const n=parseCZ(input.value); input.value=isNaN(n)?'':fmt.format(n); input.blur(); }});
          input.dataset.fmtBound='1';
        }
      }
      let l = setting.querySelector(`label[for="${id}"]`) || mk('<label class="lbl"></label>');
      l.textContent='Kč/MWh'; l.setAttribute('for', id); move(l, colLab);

      setting.querySelectorAll('label').forEach(x=>{ if(x!==l && !row.contains(x) && /Kč\/MWh/.test(x.textContent||'')) x.remove(); });
      setting.querySelectorAll(`#${id}`).forEach(x=>{ if(input && x!==input && !row.contains(x)) x.remove(); });
    });
  }

  if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', apply); }
  else { apply(); }
  window.addEventListener('resize', forceOneColumn);
})();

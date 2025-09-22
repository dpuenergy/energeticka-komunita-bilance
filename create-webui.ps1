# Vytvoření statického UI pro EC Balance
# Spusť v kořeni repozitáře (vytvoří složku webui a soubory).

$ErrorActionPreference = "Stop"

$root = Get-Location
$webui = Join-Path $root "webui"
if (-not (Test-Path $webui)) { New-Item -ItemType Directory -Path $webui | Out-Null }

@'
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>EC Balance – UI (Step 3)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="./style.css">
</head>
<body class="bg-slate-50 text-slate-900">
  <header class="border-b bg-white">
    <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <h1 class="text-xl font-semibold">EC Balance – jednoduché UI</h1>
      <div class="text-xs text-slate-500">verze 1 • statické HTML+JS</div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
    <div class="border-b">
      <nav class="flex gap-4" id="tabs">
        <button data-tab="step3" class="tab-btn border-b-2 border-slate-900 text-slate-900 px-2 py-2 -mb-px">Step 3</button>
        <button data-tab="outputs" class="tab-btn text-slate-500 hover:text-slate-800 px-2 py-2 -mb-px">Výstupy</button>
        <button data-tab="summary" class="tab-btn text-slate-500 hover:text-slate-800 px-2 py-2 -mb-px">Summary (Step 3)</button>
        <button data-tab="about" class="tab-btn text-slate-500 hover:text-slate-800 px-2 py-2 -mb-px">Nastavení & nápověda</button>
      </nav>
    </div>

    <div id="alert" class="hidden rounded-lg border px-4 py-3 text-sm"></div>

    <section id="tab-step3" class="tab-panel grid md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Vstupy (CSV/XLSX)</h2>

        <div class="space-y-2">
          <label class="block text-sm font-medium">eano_after_pv_csv</label>
          <input id="file-eano" type="file" accept=".csv,.xlsx" class="file-input">
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">eand_after_pv_csv</label>
          <input id="file-eand" type="file" accept=".csv,.xlsx" class="file-input">
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">local_selfcons_csv</label>
          <input id="file-local" type="file" accept=".csv,.xlsx" class="file-input">
        </div>

        <details class="text-sm text-slate-500">
          <summary class="cursor-pointer">Do budoucna: kwp_by_site.csv</summary>
          <p class="mt-2">UI je připravené; endpoint pro upload použijeme stejně, až bude potřeba.</p>
        </details>

        <h2 class="text-lg font-semibold mt-6">Parametry</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium">price_commodity_mwh</label>
            <input id="price_commodity_mwh" type="number" step="1" value="2200" class="text-input">
          </div>
          <div>
            <label class="block text-sm font-medium">price_distribution_mwh</label>
            <input id="price_distribution_mwh" type="number" step="1" value="1800" class="text-input">
          </div>
          <div>
            <label class="block text-sm font-medium">price_feed_in_mwh</label>
            <input id="price_feed_in_mwh" type="number" step="1" value="1200" class="text-input">
          </div>
          <div>
            <label class="block text-sm font-medium">mode</label>
            <select id="mode" class="text-input">
              <option value="hybrid" selected>hybrid</option>
              <option value="proportional">proportional</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium">max_recipients</label>
            <input id="max_recipients" type="number" step="1" value="3" class="text-input">
          </div>
        </div>

        <button id="run-step3" class="btn-primary mt-2">Spustit krok 3</button>
        <div id="run-status" class="text-sm text-slate-500 mt-2"></div>
      </div>

      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Výsledek běhu</h2>
        <div class="rounded-lg border bg-white p-3">
          <div class="text-sm">Stav: <span id="run-ok" class="font-mono">–</span></div>
          <div class="text-sm">Return code: <span id="run-rc" class="font-mono">–</span></div>
        </div>

        <div>
          <h3 class="font-medium mb-2">Nově vytvořená CSV</h3>
          <ul id="new-csv" class="list-disc pl-5 space-y-1"></ul>
        </div>

        <div>
          <h3 class="font-medium mb-2">Log</h3>
          <pre id="run-log" class="codebox h-64"></pre>
        </div>
      </div>
    </section>

    <section id="tab-outputs" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-3">Dostupné výstupy</h2>
      <div id="outputs-list" class="rounded-lg border bg-white p-3">
        <div class="text-sm text-slate-500">Načítám…</div>
      </div>
    </section>

    <section id="tab-summary" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-3">Summary (step3)</h2>
      <pre id="summary-json" class="codebox h-96">—</pre>
    </section>

    <section id="tab-about" class="tab-panel hidden space-y-4">
      <h2 class="text-lg font-semibold">Nastavení & nápověda</h2>
      <div class="rounded-lg border bg-white p-4 space-y-2 text-sm">
        <div>Aktuální API: <code id="api-base" class="font-mono"></code></div>
        <p>Přepsat lze přes query param <code>?api=https://moje-backend-url</code>.</p>
        <p>Otevřít můžete jako <code>file://</code> nebo pod <code>/ui</code> na FastAPI.</p>
      </div>
      <div class="rounded-lg border bg-white p-4 text-sm space-y-2">
        <h3 class="font-medium">Pozn.: předpřipravené záložky pro další kroky</h3>
        <p>UI je psané bez frameworku, aby šlo snadno rozšířit o Step 4a/4b/5a/5.</p>
      </div>
    </section>
  </main>

  <footer class="text-center text-xs text-slate-500 py-6">
    © EC Balance UI – statická verze
  </footer>

  <script src="./config.js"></script>
  <script src="./app.js"></script>
</body>
</html>
'@ | Set-Content -Path (Join-Path $webui "index.html") -Encoding UTF8

@"
// Konfigurace API base URL
// Výchozí lokální backend:
window.API_BASE_URL = "http://127.0.0.1:8000";

(function applyApiOverride() {
  try {
    const p = new URLSearchParams(window.location.search);
    const override = p.get("api");
    if (override) {
      window.API_BASE_URL = override;
    }
  } catch (e) {
    console.warn("API override nepodařilo se načíst:", e);
  }
  // Ukázat aktuální hodnotu v UI (pokud existuje element)
  window.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("api-base");
    if (el) el.textContent = window.API_BASE_URL;
  });
})();
"@ | Set-Content -Path (Join-Path $webui "config.js") -Encoding UTF8

@"
// Malý API wrapper s robustním error-handlingem
const API = (() => {
  const base = () => window.API_BASE_URL?.replace(/\\/$/, "") || "";
  const headersJson = { "Content-Type": "application/json" };

  async function handle(r) {
    if (!r.ok) {
      let bodyText = "";
      try { bodyText = await r.text(); } catch {}
      const msg = bodyText || r.statusText || "Chyba požadavku";
      throw new Error(msg);
    }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) return r.json();
    return r.text();
  }

  async function upload(key, file) {
    const url = base() + "/api/upload";
    const fd = new FormData();
    fd.append("key", key);
    fd.append("file", file);
    const r = await fetch(url, { method: "POST", body: fd });
    return handle(r);
  }

  async function runStep(step, params) {
    const url = base() + "/api/run/" + encodeURIComponent(step);
    const r = await fetch(url, { method: "POST", headers: headersJson, body: JSON.stringify(params) });
    return handle(r);
  }

  async function listOutputs() {
    const r = await fetch(base() + "/api/outputs");
    return handle(r);
  }

  async function summaryStep3() {
    const r = await fetch(base() + "/api/summary/step3");
    return handle(r);
  }

  function downloadUrl(name) {
    return base() + "/api/outputs/" + encodeURIComponent(name);
  }

  return { upload, runStep, listOutputs, summaryStep3, downloadUrl };
})();

// Pomocné UI utility
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function showAlert(type, message) {
  const el = qs("#alert");
  const base = "rounded-lg border px-4 py-3 text-sm";
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-green-50 border-green-200 text-green-900",
    error: "bg-red-50 border-red-200 text-red-900",
    warn: "bg-yellow-50 border-yellow-200 text-yellow-900",
  };
  el.className = base + " " + (styles[type] || styles.info);
  el.textContent = message;
  el.classList.remove("hidden");
  if (type === "success" || type === "info") {
    setTimeout(() => el.classList.add("hidden"), 4000);
  }
}

function clearAlert() {
  const el = qs("#alert");
  el.classList.add("hidden");
  el.textContent = "";
}

function setupTabs() {
  const tabs = qs("#tabs");
  tabs?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    const tab = btn.getAttribute("data-tab");
    qsa(".tab-btn").forEach(b => b.classList.remove("border-b-2","border-slate-900","text-slate-900"));
    btn.classList.add("border-b-2","border-slate-900","text-slate-900");
    qsa(".tab-panel").forEach(p => p.classList.add("hidden"));
    qs("#tab-" + tab)?.classList.remove("hidden");
  });
}

async function refreshOutputs() {
  const box = qs("#outputs-list");
  box.innerHTML = '<div class="text-sm text-slate-500">Načítám…</div>';
  try {
    const data = await API.listOutputs();
    const list = Array.isArray(data?.csv) ? data.csv : [];
    if (!list.length) {
      box.innerHTML = '<div class="text-sm text-slate-500">Žádné výstupy zatím nejsou.</div>';
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "list-disc pl-5 space-y-1";
    list.forEach(name => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = API.downloadUrl(name);
      a.textContent = name;
      a.className = "text-blue-700 hover:underline break-all";
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.innerHTML = "";
    box.appendChild(ul);
  } catch (err) {
    box.innerHTML = '<div class="text-sm text-red-700 whitespace-pre-wrap"></div>';
    box.firstChild.textContent = String(err?.message || err);
  }
}

async function refreshSummary() {
  const pre = qs("#summary-json");
  pre.textContent = "Načítám…";
  try {
    const data = await API.summaryStep3();
    pre.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    pre.textContent = "Chyba při načítání summary:\\n" + String(err?.message || err);
  }
}

async function runStep3() {
  clearAlert();
  const btn = qs("#run-step3");
  const status = qs("#run-status");
  const runOk = qs("#run-ok");
  const runRc = qs("#run-rc");
  const runLog = qs("#run-log");
  const newCsv = qs("#new-csv");

  runOk.textContent = "–";
  runRc.textContent = "–";
  runLog.textContent = "";
  newCsv.innerHTML = "";

  const fEano = qs("#file-eano").files[0];
  const fEand = qs("#file-eand").files[0];
  const fLocal = qs("#file-local").files[0];

  if (!fEano || !fEand || !fLocal) {
    showAlert("warn", "Prosím vyber tři vstupní soubory (eano/eand/local).");
    return;
  }

  const price_commodity_mwh = Number(qs("#price_commodity_mwh").value || 2200);
  const price_distribution_mwh = Number(qs("#price_distribution_mwh").value || 1800);
  const price_feed_in_mwh = Number(qs("#price_feed_in_mwh").value || 1200);
  const mode = qs("#mode").value || "hybrid";
  const max_recipients = Number(qs("#max_recipients").value || 3);

  btn.disabled = true;
  btn.classList.add("opacity-60","cursor-not-allowed");
  status.textContent = "Běží… nahrávám soubory a spouštím výpočet.";
  try {
    const upEano = await API.upload("eano_after_pv_csv", fEano);
    const upEand = await API.upload("eand_after_pv_csv", fEand);
    const upLocal = await API.upload("local_selfcons_csv", fLocal);

    const params = {
      eano_after_pv_csv: upEano?.saved_as || "data/uploads/eano_after_pv_csv.csv",
      eand_after_pv_csv: upEand?.saved_as || "data/uploads/eand_after_pv_csv.csv",
      local_selfcons_csv: upLocal?.saved_as || "data/uploads/local_selfcons_csv.csv",
      outdir: "out",
      price_commodity_mwh,
      price_distribution_mwh,
      price_feed_in_mwh,
      mode,
      max_recipients,
    };

    const res = await API.runStep("step3", params);
    runOk.textContent = res?.ok ? "OK" : "FAILED";
    runRc.textContent = (typeof res?.return_code === "number") ? String(res.return_code) : "—";
    runLog.textContent = typeof res?.log === "string" ? res.log : JSON.stringify(res, null, 2);

    if (Array.isArray(res?.new_csv) && res.new_csv.length) {
      res.new_csv.forEach(name => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = API.downloadUrl(name);
        a.textContent = name;
        a.className = "text-blue-700 hover:underline break-all";
        li.appendChild(a);
        newCsv.appendChild(li);
      });
    }

    showAlert("success", "Krok 3 proběhl. Výstupy a summary jsem obnovil.");
  } catch (err) {
    showAlert("error", "Chyba: " + String(err?.message || err));
  } finally {
    btn.disabled = false;
    btn.classList.remove("opacity-60","cursor-not-allowed");
    status.textContent = "";
    await refreshOutputs();
    await refreshSummary();
  }
}

function setupRun() { qs("#run-step3")?.addEventListener("click", runStep3); }

window.addEventListener("DOMContentLoaded", async () => {
  (function applyApiLabel(){ const el = document.getElementById("api-base"); if (el) el.textContent = window.API_BASE_URL; })();
  (function setupTabs(){
    const tabs = document.getElementById("tabs");
    tabs?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      const tab = btn.getAttribute("data-tab");
      Array.from(document.querySelectorAll(".tab-btn")).forEach(b => b.classList.remove("border-b-2","border-slate-900","text-slate-900"));
      btn.classList.add("border-b-2","border-slate-900","text-slate-900");
      Array.from(document.querySelectorAll(".tab-panel")).forEach(p => p.classList.add("hidden"));
      document.getElementById("tab-" + tab)?.classList.remove("hidden");
    });
  })();
  setupRun();
  await refreshOutputs();
  await refreshSummary();
});
"@ | Set-Content -Path (Join-Path $webui "app.js") -Encoding UTF8

@'
/* Volitelné drobnosti navíc */
.file-input { @apply block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm; }
.text-input { @apply block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm; }
.btn-primary { @apply inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800; }
.codebox { @apply rounded-lg border bg-white p-3 overflow-auto text-xs leading-relaxed; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
'@ | Set-Content -Path (Join-Path $webui "style.css") -Encoding UTF8

Write-Host "Hotovo. Soubory jsou ve složce 'webui'." -ForegroundColor Green

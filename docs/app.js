// MalĂ˝ API wrapper s robustnĂ­m error-handlingem
const API = (() => {
  const base = () => window.API_BASE_URL?.replace(/\\/$/, "") || "";
  const headersJson = { "Content-Type": "application/json" };

  async function handle(r) {
    if (!r.ok) {
      let bodyText = "";
      try { bodyText = await r.text(); } catch {}
      const msg = bodyText || r.statusText || "Chyba poĹľadavku";
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

// PomocnĂ© UI utility
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
  box.innerHTML = '<div class="text-sm text-slate-500">NaÄŤĂ­tĂˇmâ€¦</div>';
  try {
    const data = await API.listOutputs();
    const list = Array.isArray(data?.csv) ? data.csv : [];
    if (!list.length) {
      box.innerHTML = '<div class="text-sm text-slate-500">Ĺ˝ĂˇdnĂ© vĂ˝stupy zatĂ­m nejsou.</div>';
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
  pre.textContent = "NaÄŤĂ­tĂˇmâ€¦";
  try {
    const data = await API.summaryStep3();
    pre.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    pre.textContent = "Chyba pĹ™i naÄŤĂ­tĂˇnĂ­ summary:\\n" + String(err?.message || err);
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

  runOk.textContent = "â€“";
  runRc.textContent = "â€“";
  runLog.textContent = "";
  newCsv.innerHTML = "";

  const fEano = qs("#file-eano").files[0];
  const fEand = qs("#file-eand").files[0];
  const fLocal = qs("#file-local").files[0];

  if (!fEano || !fEand || !fLocal) {
    showAlert("warn", "ProsĂ­m vyber tĹ™i vstupnĂ­ soubory (eano/eand/local).");
    return;
  }

  const price_commodity_mwh = Number(qs("#price_commodity_mwh").value || 2200);
  const price_distribution_mwh = Number(qs("#price_distribution_mwh").value || 1800);
  const price_feed_in_mwh = Number(qs("#price_feed_in_mwh").value || 1200);
  const mode = qs("#mode").value || "hybrid";
  const max_recipients = Number(qs("#max_recipients").value || 3);

  btn.disabled = true;
  btn.classList.add("opacity-60","cursor-not-allowed");
  status.textContent = "BÄ›ĹľĂ­â€¦ nahrĂˇvĂˇm soubory a spouĹˇtĂ­m vĂ˝poÄŤet.";
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
    runRc.textContent = (typeof res?.return_code === "number") ? String(res.return_code) : "â€”";
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

    showAlert("success", "Krok 3 probÄ›hl. VĂ˝stupy a summary jsem obnovil.");
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

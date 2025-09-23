(function(){
  async function setBuildInfo() {
    const el = document.getElementById("build-info");
    if (!el) return;

    // 1) Zkus lokální build-info.json (když existuje)
    try {
      const r = await fetch("./build-info.json", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        if (data && data.commit) {
          el.textContent = uild  · ;
          return;
        }
      }
    } catch (e) { /* ignore */ }

    // 2) Fallback: poslední commit z GitHub API (main)
    try {
      const repo = "dpuenergy/energeticka-komunita-bilance";
      const r = await fetch(https://api.github.com/repos//commits/main, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      const sha = data?.sha;
      const dt  = data?.commit?.committer?.date;
      if (sha && dt) {
        el.textContent = uild  · ;
      }
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setBuildInfo);
  } else {
    setBuildInfo();
  }
})();

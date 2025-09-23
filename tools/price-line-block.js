/* === PRICE-LINE LAYOUT (final, stable) === */
document.addEventListener("DOMContentLoaded", () => {
  function formatCZ(num) {
    return num.toLocaleString("cs-CZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // najdi všechny price-line řádky
  document.querySelectorAll(".price-line").forEach((row) => {
    const seg = row.getAttribute("data-seg") || "";

    // původní input
    const input = row.querySelector("input");
    if (!input) return;

    // původní value → naformátuj
    let val = parseFloat(input.value.replace(",", "."));
    if (!isNaN(val)) {
      input.value = formatCZ(val);
    }

    // nový layout [seg | input | Kč/MWh]
    const cellSeg = document.createElement("div");
    cellSeg.className = "pl-seg";
    cellSeg.textContent = seg;

    const cellInput = document.createElement("div");
    cellInput.className = "pl-input";
    cellInput.appendChild(input);

    const cellUnit = document.createElement("div");
    cellUnit.className = "pl-unit";
    cellUnit.textContent = "Kč/MWh";

    // vyčisti řádek a přidej nové cell
    row.innerHTML = "";
    row.classList.add("pl-final");
    row.appendChild(cellSeg);
    row.appendChild(cellInput);
    row.appendChild(cellUnit);
  });

  // Zajisti pořadí: commodity → distribution → feedin
  const container = document.querySelector("#price-lines");
  if (container) {
    const order = ["commodity", "distribution", "feedin"];
    order.forEach((seg) => {
      const el = container.querySelector(`.price-line[data-seg="${seg}"]`);
      if (el) container.appendChild(el);
    });
  }
});

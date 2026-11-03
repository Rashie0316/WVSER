/* Western Visayas Socioeconomic Indicators Dashboard */
"use strict";

/* ---------- helpers ---------- */
const fmtInt = n => n == null ? "–" : n.toLocaleString("en-PH");
const fmt1 = n => n == null ? "–" : n.toLocaleString("en-PH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed1 = n => (n > 0 ? "+" : "") + fmt1(n);
const inPHPB = v => v / 1e6; // PHP '000 -> PHP billion

const C = {
  navy: "#14355c", navy2: "#1d4a7e", teal: "#0e7c6b", teal2: "#15998a",
  gold: "#d4a017", red: "#c0504d", gray: "#94a3b8", light: "#9db8d4"
};
const chartFont = { family: '"Segoe UI","Helvetica Neue",Arial,sans-serif' };

const yearOf = g => Number(g.label.split(" ")[1]);
const monthIdx = g => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(g.label.split(" ")[0]);

/* ---------- tabs ---------- */
const builders = {}; // tab -> fn, run once when tab first shown
const built = {};
const charts = {}; // tab -> [chart instances]

function activate(tab, push) {
  // build the tab's content FIRST, so the class toggle below can mark it active
  if (!built[tab] && builders[tab]) { built[tab] = true; builders[tab](); }
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === "tab-" + tab));
  if (charts[tab]) charts[tab].forEach(ch => ch.resize());
}
document.getElementById("tabs").addEventListener("click", e => {
  const btn = e.target.closest(".tab");
  if (btn) {
    activate(btn.dataset.tab);
    try { history.replaceState(null, "", "#" + btn.dataset.tab); } catch (err) {}
  }
});
document.querySelectorAll(".kpi[data-detail]").forEach(k => {
  k.addEventListener("click", () => activate(k.dataset.detail));
});

/* shared builder for a canvas */
function makeChart(tab, id, cfg) {
  const el = document.getElementById(id);
  if (!el) return;
  const ch = new Chart(el, cfg);
  (charts[tab] = charts[tab] || []).push(ch);
  return ch;
}

/* =================================================================
   OVERVIEW
================================================================= */
builders.overview = () => {
  const pop = WV.population, grdp = WV.grdp, pov = WV.poverty, inf = WV.inflation;
  const grdp2024 = grdp.growth.find(g => g.year === 2024);
  const inf2025 = inf.annual.find(a => a.year === 2025);
  const pov2023 = pov.region[pov.years.indexOf(2023)];

  text("ov-pop", fmtInt(pop.total2024));
  text("ov-pop-sub", `${fmt1(pop.nationalShare)}% of national population · ${pop.totalRegions} regions`);
  text("ov-grdp", signed1(grdp2024.value) + "%");
  text("ov-grdp-sub", `real GRDP ₱${fmt1(inPHPB(grdp.level[grdp.level.length-1].value))} B in 2024`);
  text("ov-pov", fmt1(pov2023) + "%");
  const prev = pov.region[pov.years.indexOf(2021)];
  const sub = subEl("ov-pov-sub");
  sub.textContent = `${signed1(pov2023 - prev)} pp vs 2021 · national 10.9%`;
  sub.className = "kpi-sub " + (pov2023 < prev ? "up" : "down");
  text("ov-inf", fmt1(inf2025.value) + "%");
  text("ov-inf-sub", "average of Jan–Dec 2025 · series low");

  // facts
  const facts = [
    `Population reached <b>${fmtInt(pop.total2024)}</b> in 2024 — <b>+131,143</b> more persons than the 2020 census.`,
    `Iloilo Province is the most populous (${fmtInt(2082616)}), while Antique grew the fastest (<b>1.16%</b> a year, 2020–2024).`,
    `GRDP grew <b>10.2%</b> in 2022, easing to <b>6.8%</b> in 2023 and <b>4.3%</b> in 2024.`,
    `Poverty incidence among families fell to <b>9.8%</b> in 2023 from 12.1% in 2021 — better than the 10.9% national average.`,
    `Inflation decelerated from 5.9% (2022) to <b>1.5%</b> in 2025; the series peaked at <b>9.9%</b> in Feb 2023.`
  ];
  document.getElementById("ov-facts").innerHTML =
    facts.map((f, i) => `<li><span class="dot" style="background:${[C.teal, C.gold, C.navy, C.teal2, C.navy2][i]}"></span><span>${f}</span></li>`).join("");

  // sector directory chips
  const chips = Object.entries(WV.sectors).map(([id, s]) =>
    `<button class="sector-chip" data-tab="${id}">${s.name} <b>${s.indicators.length}</b></button>`).join("");
  html("ov-sector-chips", chips);
  document.querySelectorAll("#ov-sector-chips .sector-chip").forEach(b =>
    b.addEventListener("click", () => activate(b.dataset.tab)));

  // chart: inflation bars + GRDP growth line
  const years = WV.inflation.annual.map(a => a.year);
  makeChart("overview", "ov-chart", {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        { label: "Inflation, Region VI (%)", data: WV.inflation.annual.map(a => a.value), backgroundColor: C.teal, borderRadius: 5, yAxisID: "y2", order: 2 },
        { label: "GRDP growth (%)", type: "line", data: WV.grdp.growth.map(g => g.value), borderColor: C.navy, backgroundColor: C.navy, borderWidth: 2.5, pointRadius: 4, tension: .3, yAxisID: "y1", order: 1 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: commonScales({
        y1: { position: "left", title: { display: true, text: "GRDP growth, %" } },
        y2: { position: "right", title: { display: true, text: "Inflation, %" }, grid: { drawOnChartArea: false } }
      })
    }
  });

  initSearch();
};

/* --- global indicator search (Overview) --- */
function initSearch() {
  const input = document.getElementById("ov-search");
  const box = document.getElementById("ov-search-results");
  const index = Object.entries(WV.sectors).flatMap(([sid, s]) =>
    s.indicators.map(i => ({ sector: sid, sectorName: s.name, name: i.name, agency: i.agency || "" }))
  ).concat([
    { page: "population", sectorName: "Page", name: "Population — 2024 Census", agency: "PSA" },
    { page: "grdp", sectorName: "Page", name: "GRDP — Gross Regional Domestic Product", agency: "PSA" },
    { page: "poverty", sectorName: "Page", name: "Poverty Statistics", agency: "PSA" },
    { page: "inflation", sectorName: "Page", name: "Inflation Rate — regional, provincial, monthly", agency: "PSA" }
  ]);

  function hide() { box.hidden = true; box.innerHTML = ""; }
  function render() {
    const q = input.value.trim().toLowerCase();
    if (!q) { hide(); return; }
    const hits = index.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.agency || "").toLowerCase().includes(q) ||
      e.sectorName.toLowerCase().includes(q));
    box.hidden = false;
    if (!hits.length) {
      box.innerHTML = `<div class="search-empty">No indicator matches “${input.value.trim()}”.</div>`;
      return;
    }
    box.innerHTML = hits.map((e, i) => `
      <button class="search-result ${i === 0 ? "hl" : ""}" data-sector="${e.sector || ""}" data-page="${e.page || ""}" data-name="${e.name.replace(/"/g, "&quot;")}">
        <span>${e.name}</span>
        <span class="sr-agency">${e.agency}</span>
        <span class="sr-sector">${e.sectorName}</span>
      </button>`).join("");
    box.querySelectorAll(".search-result").forEach(btn => btn.addEventListener("click", () => go(btn)));
  }
  function go(btn) {
    const sector = btn.dataset.sector, page = btn.dataset.page, name = btn.dataset.name;
    hide(); input.value = "";
    activate(sector || page);                      // builds the sector page if needed
    if (sector) {
      const ind = WV.sectors[sector].indicators.find(i => i.name === name);
      if (ind) selectIndicator(sector, ind.id);
    }
  }

  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("keydown", e => {
    if (e.key === "Escape") { input.value = ""; hide(); input.blur(); }
    if (e.key === "Enter") {
      const first = box.querySelector(".search-result");
      if (first) go(first);
    }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) hide();
  });
};

function commonScales(extra) {
  return Object.assign({
    x: { grid: { display: false }, ticks: { font: chartFont } },
    y: { beginAtZero: true, ticks: { callback: v => v, font: chartFont } }
  }, extra || {});
}
function text(id, s) { const el = document.getElementById(id); if (el) el.textContent = s; }
function subEl(id) { return document.getElementById(id); }
function html(id, h) { const el = document.getElementById(id); if (el) el.innerHTML = h; }

/* =================================================================
   POPULATION
================================================================= */
builders.population = () => {
  const p = WV.population, tot = p.total2024;
  const added = tot - p.censusTrend.find(c => c.year === 2020).pop;

  text("pop-total", fmtInt(tot));
  text("pop-pgr", fmt1(p.regionalPGR2020_2024) + "%");
  text("pop-share", fmt1(p.nationalShare) + "%");
  text("pop-rank", `${p.nationalRank}th largest of ${p.totalRegions} regions`);
  text("pop-added", "+" + fmtInt(added));

  // trend
  const t = p.censusTrend;
  makeChart("population", "pop-trend", {
    type: "line",
    data: {
      labels: t.map(c => String(c.year)),
      datasets: [{
        label: "Population", data: t.map(c => c.pop),
        borderColor: C.navy, backgroundColor: "rgba(20,53,92,.1)",
        borderWidth: 2.5, pointRadius: 5, fill: true, tension: .3
      }]
    },
    options: baseOpts(v => (v / 1e6).toFixed(2) + "M")
  });

  // by province
  const g = p.geos;
  makeChart("population", "pop-prov", {
    type: "bar",
    data: {
      labels: g.map(x => x.name),
      datasets: [{ label: "Population, 2024", data: g.map(x => x.pop2024), backgroundColor: g.map((x, i) => i % 2 ? C.teal : C.navy), borderRadius: 6 }]
    },
    options: Object.assign(baseOpts(v => (v / 1e6).toFixed(2) + "M"), { indexAxis: "y" })
  });

  // table
  const rows = g.map(x => {
    const share = (x.pop2024 / tot * 100);
    const pill = x.type === "Highly Urbanized City" ? "neutral" : "good";
    return `<tr>
      <td><b>${x.name}</b></td>
      <td><span class="pill ${pill}">${x.type}</span></td>
      <td class="num">${fmtInt(x.pop2024)}</td>
      <td class="num">${fmt1(share)}%</td>
      <td class="num">${fmt1(x.pgr2020_2024)}%</td>
    </tr>`;
  }).join("");
  html("pop-table", `<thead><tr><th>Province / HUC</th><th>Type</th><th class="num">Population, 2024</th><th class="num">Share of region</th><th class="num">Annual growth 2020–2024</th></tr></thead><tbody>${rows}</tbody><tbody class="total"><tr><td colspan="2">Total</td><td class="num">${fmtInt(tot)}</td><td class="num">100.0%</td><td class="num">${fmt1(p.regionalPGR2020_2024)}%</td></tr></tbody>`);

  const note = document.getElementById("pop-note");
  note.innerHTML = `
    <b>Note:</b> ${p.boundaryNote} Under the new configuration the region has five provinces (Aklan, Antique, Capiz, Guimaras and Iloilo) and Iloilo City. Source: PSA 2024 Census of Population, declared official by Proclamation No. 973, s. 2025.`;
};

function baseOpts(tickFmt) {
  return {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: chartFont } },
      y: { beginAtZero: true, ticks: { callback: tickFmt, font: chartFont } }
    }
  };
}

/* =================================================================
   GRDP
================================================================= */
builders.grdp = () => {
  const grdp = WV.grdp;
  const g2024 = grdp.growth.find(g => g.year === 2024);
  const lvl2024 = grdp.level[grdp.level.length - 1];
  const g2022 = grdp.growth.find(g => g.year === 2022);

  text("grdp-g", signed1(g2024.value) + "%");
  text("grdp-l", "₱" + fmt1(inPHPB(lvl2024.value)) + "B");
  text("grdp-peak", signed1(g2022.value) + "%");

  // rank of VI in 2022 growth
  const r2022 = grdp.regions.slice().sort((a, b) => (b.growth[2022] ?? -99) - (a.growth[2022] ?? -99));
  const rk = r2022.findIndex(r => r.geo === "VI") + 1;
  text("grdp-peak-sub", r2022.length ? `2022 — fastest year in the series (rank ${rk} of ${grdp.regions.length} regions)` : "2022 — start of the series");

  // growth line
  makeChart("grdp", "grdp-growth", {
    type: "line",
    data: {
      labels: grdp.growth.map(g => g.year),
      datasets: [{ label: "GRDP growth (%)", data: grdp.growth.map(g => g.value), borderColor: C.navy, backgroundColor: "rgba(20,53,92,.12)", borderWidth: 2.5, pointRadius: 5, fill: true, tension: .3 }]
    },
    options: Object.assign(baseOpts(v => v + "%"), { plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12 } } } })
  });

  // regions comparison 2024
  const names = grdp.regions.map(r => r.geo === "VI" ? r.geoName.replace(" (Region VI)", " ★") : r.geoName.replace(/\s*\(Region [^\)]*\)/, "").replace("Bangsamoro Autonomous Region in Muslim Mindanao", "BARMM"));
  const vals = grdp.regions.map(r => r.growth[2024] ?? null);
  makeChart("grdp", "grdp-regions", {
    type: "bar",
    data: { labels: names, datasets: [{ label: "Growth 2024, %", data: vals, backgroundColor: grdp.regions.map(r => r.geo === "VI" ? C.gold : C.light), borderRadius: 4 }] },
    options: Object.assign({}, baseOpts(v => v + "%"), { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { callback: v => v + "%", font: chartFont } }, y: { ticks: { font: { size: 10.5 } }, grid: { display: false } } } })
  });

  // level
  makeChart("grdp", "grdp-level", {
    type: "bar",
    data: {
      labels: grdp.level.map(l => l.year),
      datasets: [{
        label: "Real GRDP (PHP billion)",
        data: grdp.level.map(l => +inPHPB(l.value).toFixed(2)),
        backgroundColor: grdp.level.map((_, i) => i === grdp.level.length - 1 ? C.teal : C.light),
        borderRadius: 8
      }]
    },
    options: baseOpts(v => "₱" + v + "B")
  });
};

/* =================================================================
   POVERTY
================================================================= */
builders.poverty = () => {
  const pv = WV.poverty;
  const i23 = pv.years.indexOf(2023), i21 = pv.years.indexOf(2021);
  const v23 = pv.region[i23], v21 = pv.region[i21];

  text("pov-2023", fmt1(v23) + "%");
  text("pov-chg", signed1(v23 - v21) + " pp");
  text("pov-vs-nat", fmt1(Math.abs(v23 - pv.national[i23])) + (v23 <= pv.national[i23] ? " pp lower" : " pp higher"));
  text("pov-thresh", "₱" + fmtInt(pv.thresholdsPHP[i23]));

  html("pov-notes", `<b>Notes</b><ul>${pv.notes.map(n => `<li>${n}</li>`).join("")}</ul>`);

  // by province
  const geos = pv.geos;
  const colors = { 0: C.light, 1: C.teal, 2: C.navy };
  makeChart("poverty", "pov-prov", {
    type: "bar",
    data: {
      labels: geos.map(g => g.name),
      datasets: pv.years.map((y, yi) => ({
        label: y,
        data: geos.map(g => g.values[yi]),
        backgroundColor: [C.light, C.teal, C.navy][yi],
        borderRadius: 4
      }))
    },
    options: Object.assign(baseOpts(v => v + "%"), { plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } } } })
  });

  // region vs national
  makeChart("poverty", "pov-trend", {
    type: "line",
    data: {
      labels: pv.years.map(String),
      datasets: [
        { label: "Western Visayas", data: pv.region, borderColor: C.teal, backgroundColor: C.teal, borderWidth: 3, pointRadius: 5, tension: .3 },
        { label: "Philippines", data: pv.national, borderColor: C.gray, backgroundColor: C.gray, borderWidth: 2, pointRadius: 4, borderDash: [6, 4], tension: .3 }
      ]
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v + "%" } } } }
  });

  // table
  const rows = geos.map(g => {
    const vals = g.values;
    const chg = vals[i23] - vals[i21];
    const cls = !chg ? "" : (chg < 0 ? "good" : "bad");
    return `<tr><td><b>${g.name}</b></td>
      <td class="num">${fmt1(vals[0])}</td><td class="num">${fmt1(vals[1])}</td><td class="num">${fmt1(vals[2])}</td>
      <td class="num"><span class="pill ${cls}">${signed1(chg)} pp</span></td></tr>`;
  }).join("");
  const regionRow = `<tr class="total"><td>Western Visayas</td><td class="num">${fmt1(pv.region[0])}</td><td class="num">${fmt1(pv.region[1])}</td><td class="num">${fmt1(pv.region[2])}</td><td class="num"><span class="pill ${v23 - v21 < 0 ? "good" : "bad"}">${signed1(v23 - v21)} pp</span></td></tr>`;
  html("pov-table", `<thead><tr><th>Province / HUC</th><th class="num">2018</th><th class="num">2021</th><th class="num">2023</th><th class="num">Change 2021→2023</th></tr></thead><tbody>${rows}${regionRow}</tbody>`);
};

/* =================================================================
   INFLATION
================================================================= */
builders.inflation = () => {
  const inf = WV.inflation;
  const a2025 = inf.annual[inf.annual.length - 1];
  const a2022 = inf.annual[0];
  const monthly = [...inf.monthly].sort((a, b) => yearOf(a) - yearOf(b) || monthIdx(a) - monthIdx(b));
  const latest = monthly[monthly.length - 1];
  const peak = monthly.reduce((m, x) => x.value > m.value ? x : m, monthly[0]);

  text("inf-annual", fmt1(a2025.value) + "%");
  text("inf-annual-sub", "lowest annual average in the series (2022: " + fmt1(a2022.value) + "%)");
  text("inf-latest", fmt1(latest.value) + "%");
  text("inf-latest-sub", latest.label + " · year-on-year");
  text("inf-peak", fmt1(peak.value) + "%");
  text("inf-peak-sub", peak.label);

  // annual chart
  makeChart("inflation", "inf-annual-chart", {
    type: "bar",
    data: {
      labels: inf.annual.map(a => a.year),
      datasets: [{ label: "Inflation (%)", data: inf.annual.map(a => a.value), backgroundColor: inf.annual.map((_, i) => i === inf.annual.length - 1 ? C.teal : C.light), borderRadius: 6 }]
    },
    options: baseOpts(v => v + "%")
  });

  // monthly chart
  makeChart("inflation", "inf-monthly", {
    type: "line",
    data: {
      labels: monthly.map(m => m.label),
      datasets: [{ label: "Inflation, Region VI (%)", data: monthly.map(m => m.value), borderColor: C.navy, backgroundColor: "rgba(20,53,92,.08)", borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: .25 }]
    },
    options: Object.assign(baseOpts(v => v + "%"), {
      plugins: { legend: { display: false }, tooltip: { callbacks: {} } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 60 }, autoSkip: true, maxTicksLimit: 16 }, y: { beginAtZero: true, ticks: { callback: v => v + "%" } } }
    })
  });

  // provincial years
  const years = [2022, 2023, 2024, 2025];
  let selYear = 2025;
  const ybtn = document.getElementById("inf-prov-years");
  ybtn.innerHTML = years.map(y => `<button data-y="${y}" class="${y === selYear ? "active" : ""}">${y}</button>`).join("");
  ybtn.addEventListener("click", e => {
    const b = e.target.closest("button[data-y]");
    if (!b) return;
    selYear = +b.dataset.y;
    ybtn.querySelectorAll("button").forEach(x => x.classList.toggle("active", +x.dataset.y === selYear));
    (charts.inflation || []).forEach(c => {
      if (c.canvas && c.canvas.id === "inf-prov-chart") c.destroy();
    });
    charts.inflation = charts.inflation.filter(c => !c.canvas || c.canvas.id !== "inf-prov-chart");
    drawProv();
  });

  function drawProv() {
    const geos = inf.provincial.map(p => p.name);
    const vals = inf.provincial.map(p => p.values[selYear] ?? null);
    makeChart("inflation", "inf-prov-chart", {
      type: "bar",
      data: {
        labels: geos,
        datasets: [{ label: `Inflation ${selYear} (%)`, data: vals, backgroundColor: vals.map(v => v < 0 ? C.red : C.teal), borderRadius: 6 }]
      },
      options: Object.assign(baseOpts(v => v + "%"), { plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 10 } } } })
    });
  }
  drawProv();

  // table
  const trows = inf.provincial.map(g => `<tr><td><b>${g.name}</b></td>${years.map(y => `<td class="num">${fmt1(g.values[y])}</td>`).join("")}</tr>`).join("");
  html("inf-table", `<thead><tr><th>Province / HUC</th>${years.map(y => `<th class="num">${y}</th>`).join("")}</tr></thead><tbody>${trows}<tr class="total"><td>Region VI average</td>${years.map(y => `<td class="num"><b>${fmt1((inf.annual.find(a => a.year === y) || {}).value)}</b></td>`).join("")}</tr></tbody>`);
};

/* =================================================================
   SECTOR PAGES (data-driven, one generic renderer)
================================================================= */
const isRate = u => /percent|rate|ratio/i.test(u || "");
const aggType = u => isRate(u) ? "avg" : "sum";
const aggWord = t => t === "avg" ? "simple average of reported areas" : "sum of reported areas";

function unitFmt(unit, v) {
  if (v == null) return "–";
  if (/php\s*\('000\)/i.test(unit)) {
    const b = v / 1e6;
    return "₱" + (b >= 100 ? fmt1(b) : b.toLocaleString("en-PH", { maximumFractionDigits: 2 })) + "B";
  }
  if (/^php$/i.test(unit)) {
    const a = Math.abs(v);
    if (a >= 1e12) return "₱" + (v / 1e12).toLocaleString("en-PH", { maximumFractionDigits: 2 }) + "T";
    if (a >= 1e9) return "₱" + (v / 1e9).toLocaleString("en-PH", { maximumFractionDigits: 2 }) + "B";
    if (a >= 1e6) return "₱" + (v / 1e6).toLocaleString("en-PH", { maximumFractionDigits: 1 }) + "M";
    return "₱" + v.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  }
  if (/percent/i.test(unit)) return fmt1(v) + "%";
  if (Number.isInteger(v)) return fmtInt(v);
  return v.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}
function tickFmt(unit) {
  if (/percent/i.test(unit)) return v => v + "%";
  if (/php\s*\(\s*'000\s*\)/i.test(unit)) return v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(v / 1e6 >= 100 ? 1 : 2) + "B" : Number(v).toLocaleString();
  if (/^php$/i.test(unit)) return v => Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + "B" : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Number(v).toLocaleString();
  return v => Number(v).toLocaleString("en-PH");
}

const SECTOR_SUBS = {
  economic: "Trade, industry, labor, tourism and business indicators. GRDP and inflation have their own dedicated pages.",
  social: "Education, health, nutrition and social welfare indicators.",
  infrastructure: "Air transport, roads, bridges, school buildings, sanitation and vehicle registrations.",
  governance: "BIR district revenue collection and the fiscal performance of provinces.",
  environment: "Forest cover and reforestation / tree-planting areas."
};

const LEVEL_ORDER = { Region: 0, Province: 1, City: 2, Municipality: 3 };
const levelRank = g => LEVEL_ORDER[g.level] ?? 2;

function seriesOf(ind) {
  if (ind.region) return ind.region.map(d => ({ year: d.year, value: d.value }));
  const years = [...new Set(ind.geos.flatMap(g => Object.keys(g.values).map(Number)))].sort((a, b) => a - b);
  const t = aggType(ind.unit);
  return years.map(y => {
    const vals = ind.geos.map(g => g.values[String(y)]).filter(v => v != null);
    return { year: y, value: vals.length ? (t === "avg" ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0)) : null };
  });
}

function initSector(id) {
  const sec = WV.sectors[id];
  const host = document.getElementById("sector-sections");
  const el = document.createElement("section");
  el.id = "tab-" + id;
  el.className = "section";
  el.innerHTML = `
    <div class="section-head">
      <h2>${sec.name} Sector</h2>
      <p class="sub">${SECTOR_SUBS[id]}</p>
    </div>
    <div class="sector-layout">
      <aside class="card ind-card">
        <input id="${id}-search" class="ind-search" type="search" placeholder="Search indicators…">
        <div class="ind-count" id="${id}-count"></div>
        <ul class="ind-list" id="${id}-list"></ul>
      </aside>
      <div id="${id}-panel"></div>
    </div>`;
  host.appendChild(el);

  const search = el.querySelector(`#${id}-search`);
  search.addEventListener("input", () => renderIndList(id, search.value.trim().toLowerCase()));

  renderIndList(id, "");
  selectIndicator(id, sec.indicators[0].id);
}

function renderIndList(id, q) {
  const sec = WV.sectors[id];
  const items = sec.indicators.filter(i => !q || i.name.toLowerCase().includes(q) || (i.agency || "").toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
  document.getElementById(id + "-count").textContent = `${items.length} of ${sec.indicators.length} indicators`;
  html(id + "-list", items.map(i => `
    <li><button class="ind-item ${i._sel ? "active" : ""}" data-id="${i.id}">
      ${i.name}<span class="agency">${i.agency || ""} · ${i.freq || ""}</span>
    </button></li>`).join(""));
  document.getElementById(id + "-list").querySelectorAll(".ind-item").forEach(b =>
    b.addEventListener("click", () => selectIndicator(id, b.dataset.id)));
}

function selectIndicator(id, indId) {
  const sec = WV.sectors[id];
  sec.indicators.forEach(i => i._sel = i.id === indId);
  renderIndList(id, document.getElementById(id + "-search").value.trim().toLowerCase());
  const ind = sec.indicators.find(i => i.id === indId);

  // reset charts for this tab
  (charts[id] || []).forEach(c => c.destroy());
  charts[id] = [];

  const series = seriesOf(ind);
  const t = aggType(ind.unit);
  const geos = ind.geos.slice().sort((a, b) => (levelRank(a) - levelRank(b)) || a.name.localeCompare(b.name));
  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta = prev && prev.value != null && latest.value != null ? latest.value - prev.value : null;
  const goodDelta = delta == null ? "" : (ind.direction === "Lower" ? delta <= 0 : delta >= 0) ? "up" : "down";

  let kpiLabel, kpiValue;
  if (ind.region) { kpiLabel = `Region VI, ${latest.year}`; kpiValue = unitFmt(ind.unit, latest.value); }
  else if (geos.length === 1) { kpiLabel = `${geos[0].name}, ${latest.year}`; kpiValue = unitFmt(ind.unit, latest.value); }
  else { kpiLabel = `${t === "avg" ? "Average" : "Total"} of areas, ${latest.year}`; kpiValue = unitFmt(ind.unit, latest.value); }

  const dirBadge = ind.direction === "Lower"
    ? `<span class="badge dir-down">Lower is better</span>`
    : ind.direction === "Higher" ? `<span class="badge dir-up">Higher is better</span>` : "";

  // years for the by-area selector
  const geoYears = geos.length ? [...new Set(geos.flatMap(g => Object.keys(g.values).map(Number)))].sort((a, b) => b - a) : [];
  let selYear = geoYears[0];

  html(id + "-panel", `
    <div class="card">
      <div class="panel-title-row">
        <h3>${ind.name}</h3>
        <span class="kpi-mini">${ind.id}</span>
      </div>
      <div class="badges">
        ${dirBadge}
        ${ind.agency ? `<span class="badge">${ind.agency}</span>` : ""}
        ${ind.freq ? `<span class="badge">${ind.freq}</span>` : ""}
        <span class="badge">Unit: ${ind.unit}</span>
      </div>
      ${ind.desc ? `<p class="ind-desc">${ind.desc}</p>` : ""}
      <div class="kpi-grid kpi-3" style="margin-bottom:0">
        <div class="kpi" style="cursor:default">
          <span class="kpi-label">${kpiLabel}</span>
          <span class="kpi-value">${kpiValue}</span>
          <span class="kpi-sub">${ind.unit}</span>
        </div>
        <div class="kpi" style="cursor:default">
          <span class="kpi-label">Change vs ${prev ? prev.year : "–"}</span>
          <span class="kpi-value">${delta == null ? "–" : (isRate(ind.unit) ? signed1(delta) + " pp" : unitFmt(ind.unit, delta))}</span>
          <span class="kpi-sub ${delta === 0 ? "" : goodDelta}">${delta == null ? "single year of data" : delta === 0 ? "no change" : ind.direction === "Lower" ? (goodDelta === "up" ? "improving" : "worsening") : (goodDelta === "up" ? "improving" : "worsening")}</span>
        </div>
        <div class="kpi" style="cursor:default">
          <span class="kpi-label">Coverage</span>
          <span class="kpi-value" style="font-size:21px;padding-top:6px">${series[0].year}–${latest.year}</span>
          <span class="kpi-sub">${series.length} years · ${ind.region ? "region-level data" : geos.length + " areas"}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Over time${ind.region ? "" : ` (${aggWord(t)})`}</h3>
      <div class="chart-box"><canvas id="${id}-trend"></canvas></div>
      ${ind.region ? "" : `<p class="caption">${ind.geos.length} reporting areas (provinces, with cities listed separately where reported).</p>`}
    </div>

    ${geos.length > 1 ? `
    <div class="card">
      <h3>By area</h3>
      <div class="year-btns" id="${id}-ayears"></div>
      <div class="chart-box"><canvas id="${id}-byarea"></canvas></div>
    </div>` : ""}

    <div class="card">
      <h3>Data table${ind.region ? "" : " — " + aggWord(t)}</h3>
      <div class="table-wrap"><table id="${id}-table"></table></div>
    </div>
  `);

  // trend chart
  makeChart(id, `${id}-trend`, {
    type: "line",
    data: {
      labels: series.map(d => d.year),
      datasets: [{
        label: ind.name,
        data: series.map(d => d.value),
        borderColor: C.navy, backgroundColor: "rgba(20,53,92,.1)",
        borderWidth: 2.5, pointRadius: series.length <= 5 ? 5 : 2.5, fill: true, tension: .3
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: chartFont, precision: 0 } },
        y: { beginAtZero: !isRate(ind.unit) || (ind.direction === "Lower"), ticks: { callback: tickFmt(ind.unit), font: chartFont } }
      }
    }
  });

  // by-area chart
  if (geos.length > 1) {
    const ybox = document.getElementById(`${id}-ayears`);
    ybox.innerHTML = geoYears.map(y => `<button data-y="${y}" class="${y === selYear ? "active" : ""}">${y}</button>`).join("");
    ybox.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      selYear = +b.dataset.y;
      ybox.querySelectorAll("button").forEach(x => x.classList.toggle("active", +x.dataset.y === selYear));
      const inst = charts[id].find(c => c.canvas.id === `${id}-byarea`);
      if (inst) {
        inst.data.datasets[0].data = geos.map(g => g.values[String(selYear)] ?? null);
        inst.data.datasets[0].label = `${ind.name}, ${selYear}`;
        inst.data.datasets[0].backgroundColor = geos.map(g => (g.values[String(selYear)] ?? 0) < 0 ? C.red : (g.level === "City" ? C.gold : C.teal));
        inst.update();
      }
    }));
    drawByArea(selYear);
  }

  function drawByArea(year) {
    makeChart(id, `${id}-byarea`, {
      type: "bar",
      data: {
        labels: geos.map(g => g.name),
        datasets: [{
          label: `${ind.name}, ${year}`,
          data: geos.map(g => g.values[String(year)] ?? null),
          backgroundColor: geos.map(g => (g.values[String(year)] ?? 0) < 0 ? C.red : (g.level === "City" ? C.gold : C.teal)),
          borderRadius: 6
        }]
      },
      options: Object.assign(baseOpts(tickFmt(ind.unit)), { indexAxis: "y" })
    });
  }

  // data table (years × areas): Year | [Region VI] | [each area] | [Aggregate]
  const years = [...new Set(series.map(d => d.year))].sort((a, b) => b - a);
  let headers = "<th>Year</th>";
  if (ind.region) headers += `<th class="num">Region VI</th>`;
  headers += geos.map(g => `<th class="num">${g.name}</th>`).join("");
  if (geos.length > 1) headers += `<th class="num">${t === "avg" ? "Average" : "Total"}</th>`;

  const rows = years.map(y => {
    const s = series.find(d => d.year === y);
    let row = `<tr><td><b>${y}</b></td>`;
    if (ind.region) row += `<td class="num"><b>${unitFmt(ind.unit, s.value)}</b></td>`;
    row += geos.map(g => `<td class="num">${unitFmt(ind.unit, g.values[String(y)])}</td>`).join("");
    if (geos.length > 1) {
      const vals = geos.map(g => g.values[String(y)]).filter(v => v != null);
      row += `<td class="num">${vals.length ? unitFmt(ind.unit, t === "avg" ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0)) : "–"}</td>`;
    }
    return row + "</tr>";
  }).join("");
  html(`${id}-table`, `<thead><tr>${headers}</tr></thead><tbody>${rows}</tbody>`);
}

builders.economic = () => initSector("economic");
builders.social = () => initSector("social");
builders.infrastructure = () => initSector("infrastructure");
builders.governance = () => initSector("governance");
builders.environment = () => initSector("environment");

/* ---------- footer ---------- */
(function footer() {
  const m = WV.meta;
  html("footer-sources", `
    <h4>Data sources — ${m.region} indicator dashboard (prepared ${m.prepared})</h4>
    <ul>${m.sources.map(s => `<li>${s}</li>`).join("")}</ul>
    <p style="margin-top:10px">${m.note}</p>`);
})();

/* ---------- boot ---------- */
// Embed mode: ?embed=1 hides the top bar and footer (for iframe integration);
// navigation still works inside the frame.
if (new URLSearchParams(location.search).get("embed") === "1") {
  document.body.classList.add("embedded");
}
// Deep link: index.html#grdp (also honors #poverty etc.) opens that tab directly.
const __hashTab = (location.hash || "").replace("#", "");
const startTab = [...document.querySelectorAll(".tab[data-tab]")].some(t => t.dataset.tab === __hashTab) ? __hashTab : "overview";
activate(startTab);
try { history.replaceState(null, "", "#" + startTab); } catch (e) { /* file:// or sandboxed */ }

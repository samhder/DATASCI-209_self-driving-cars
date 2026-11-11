// Robotaxi Rain Check: D3 page for Hypothesis 3 (weather). Data is loaded from static/data/rain-check.json.
(function () {
fetch(window.RAIN_CHECK_DATA).then(r => r.json()).then(DATA => {
// ---------- helpers ----------
const fmtP = d3.format(".1%"), fmtP0 = d3.format(".0%"), fmtN = d3.format(","), fmt2 = d3.format(".2f");
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = () => ({ink: css("--ink"), rain: css("--rain"), clear: css("--clear"), cloudy: css("--cloudy"), gray: css("--gray"), bar: css("--bar"), text2: css("--text2"), muted: css("--muted"), line: css("--line"), card: css("--card"), ok: css("--ok")});
const tip = d3.select("#tip");
const showTip = (ev, html) => tip.html(html).style("left", Math.min(ev.clientX + 14, window.innerWidth - 300) + "px").style("top", (ev.clientY - 10) + "px").style("opacity", 1);
const hideTip = () => tip.style("opacity", 0);
const L = DATA.lookups, metros = DATA.totals.metros, ALL = "All six cities";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = ms => reduced ? 0 : ms;
const expectedOf = e => e.crashes * e.rainHours;
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 0]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; };
const isInj = r => r[6] >= 1 && r[6] <= 4;
const WNAME = ["clear", "cloudy", "rain"], WLABEL = ["Clear", "Cloudy", "Rain"];
const per100 = rate => Math.round(rate * 100);

// ---------- icons: simple outlined pictures, one idea each ----------
const svgo = (inner, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;
const ICON = {
  sun: svgo(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>`, 'style="color:var(--clear)"'),
  cloud: svgo(`<path d="M7 18a4.5 4.5 0 0 1-.8-8.9A6 6 0 0 1 17.6 8 4.5 4.5 0 0 1 17 18H7z"/>`, 'style="color:var(--cloudy)"'),
  rain: svgo(`<path d="M7 15a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 16.7 6 4.5 4.5 0 0 1 17 15H7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>`, 'style="color:var(--rain)"'),
  rainDown: svgo(`<path d="M7 13a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 16.7 4 4.5 4.5 0 0 1 17 13H7z"/><path d="M12 15v6M9.5 18.5L12 21l2.5-2.5"/>`, 'style="color:var(--rain)"'),
  shield: svgo(`<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-4"/>`, 'style="color:var(--ok)"'),
  garage: svgo(`<path d="M3 11l9-6 9 6v10H3z"/><path d="M7 21v-6h10v6"/><path d="M7 18h10"/>`, 'style="color:var(--rain)"'),
  car: svgo(`<path d="M5 15h14l-1.8-5a1.5 1.5 0 0 0-1.4-1H8.2a1.5 1.5 0 0 0-1.4 1z"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="20" r="1.3"/><circle cx="16.5" cy="20" r="1.3"/>`, 'style="color:var(--ink)"'),
  calendar: svgo(`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 15l2 2 2-3 2 2 2-3" stroke="#2b6cd4"/>`, 'style="color:var(--ink)"'),
  check: svgo(`<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.3 2.3L15.5 10"/>`),
  info: svgo(`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`),
  pin: svgo(`<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`, 'style="color:var(--rain)"'),
};
const WICON = [ICON.sun, ICON.cloud, ICON.rain];

// ---------- state ----------
const state = {city: "San Francisco", w: 2};
const metroIdx = () => state.city === ALL ? -1 : metros.indexOf(state.city);
const inCity = r => state.city === ALL || r[0] === metroIdx();
d3.select("#cityPick").selectAll("button").data([...metros, ALL]).join("button").text(d => d).on("click", (ev, d) => setState({city: d}));
d3.select("#wxPick").selectAll("button").data(WLABEL).join("button").attr("data-w", (d, i) => i).html((d, i) => `${WICON[i]}<span>${d}</span>`).on("click", (ev, d) => setState({w: WLABEL.indexOf(d)}));
const CITYSLUG = {"San Francisco": "sf", "Los Angeles": "la", "Austin": "austin", "Phoenix": "phoenix", "Atlanta": "atlanta", "Las Vegas": "lasvegas", [ALL]: "all"};
function setState(patch) {
  Object.assign(state, patch); render();
  const card = document.getElementById("answer"); card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
  try { history.replaceState(null, "", "#" + CITYSLUG[state.city] + "-" + WNAME[state.w]); } catch (e) {}
}
(function fromHash() { const m = /^#(sf|la|austin|phoenix|atlanta|lasvegas|all)-(clear|cloudy|rain)$/.exec(location.hash || ""); if (!m) return; const city = Object.keys(CITYSLUG).find(c => CITYSLUG[c] === m[1]); if (city) { state.city = city; state.w = WNAME.indexOf(m[2]); } })();

// ---------- facts for the current state ----------
function facts() {
  const mi = metroIdx(), rows = DATA.crashes.filter(inCity), n = rows.length;
  const byW = [0, 1, 2].map(w => rows.filter(r => r[1] === w));
  const ex = mi >= 0 ? [DATA.exposure[mi]] : DATA.exposure;
  const predicted = d3.sum(ex, e => Math.round(expectedOf(e))), reported = d3.sum(ex, e => e.rainCrashes), expRaw = d3.sum(ex, expectedOf);
  const sd = Math.sqrt(d3.sum(ex, e => e.crashes * e.rainHours * (1 - e.rainHours)));
  const ratio = reported / expRaw, ratioHi = mi >= 0 ? ex[0].ratioHi : (reported + 1.96 * sd) / expRaw;
  const rainHours = d3.sum(ex, e => e.crashes * e.rainHours) / d3.sum(ex, e => e.crashes);
  const inj = byW.map(s => { const k = s.filter(isInj).length; return {k, n: s.length, rate: s.length ? k / s.length : 0, ci: wilson(k, s.length)}; });
  const injAll = {k: rows.filter(isInj).length, n, rate: rows.filter(isInj).length / n};
  let mo;
  if (mi >= 0) mo = DATA.monthly[state.city];
  else {
    const byMonth = new Map();
    for (const name of metros) for (const r of DATA.monthly[name].rows) { const a = byMonth.get(r.month) || {month: r.month, crashes: 0, rain: 0, rainHours: 0, cities: 0}; a.crashes += r.crashes; a.rain += r.rain; a.rainHours += r.rainHours; a.cities++; byMonth.set(r.month, a); }
    const rows = [...byMonth.values()].sort((a, b) => a.month < b.month ? -1 : 1);
    const corr = (xs, ys) => { const mx = d3.mean(xs), my = d3.mean(ys); return d3.sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / Math.sqrt(d3.sum(xs.map(x => (x - mx) ** 2)) * d3.sum(ys.map(y => (y - my) ** 2))); };
    mo = {rows, rRain: corr(rows.map(r => r.rainHours), rows.map(r => r.rain)), rAll: corr(rows.map(r => r.rainHours), rows.map(r => r.crashes)), summed: true};
  }
  const moName = mi >= 0 ? state.city : "the six cities together";
  return {mi, city: state.city, here: mi >= 0 ? state.city : "the six cities", rows, n, byW, nW: byW.map(s => s.length), predicted, reported, ratio, excludesOne: ratioHi < 1, rainHours, inj, injAll, w: state.w, wName: WNAME[state.w], mo, moName, thin: reported < 10};
}

// ---------- the map: where the cars are, and where the rain crashes are. It is also the city picker ----------
function buildMap() {
  const el = document.getElementById("map"), k = C();
  const box = el.getBoundingClientRect(), W = Math.max(320, box.width || 640), H = Math.max(200, box.height || 300);
  const cities = DATA.cities, proj = d3.geoAlbersUsa().fitExtent([[6, 6], [W - 6, H - 6]], DATA.states), path = d3.geoPath(proj);
  cities.forEach(c => { const p = proj([c.lon, c.lat]); c.px = p ? p[0] : null; c.py = p ? p[1] : null; c.cum = d3.cumsum(c.months); });
  const placed = cities.filter(c => c.px != null), rS = d3.scaleSqrt().domain([0, d3.max(cities, c => c.n)]).range([0, Math.min(W, H) * 0.085]);
  const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", [0, 0, W, H]);
  svg.selectAll("*").remove();
  svg.append("g").selectAll("path").data(DATA.states.features).join("path").attr("d", path).attr("fill", k.card).attr("stroke", k.line).attr("stroke-width", 0.8);
  let shown = 61;
  const rad = c => rS(shown >= 61 ? c.n : c.cum[shown]);
  const sorted = placed.slice().sort((a, b) => b.n - a.n);
  const g = svg.append("g").selectAll("g").data(sorted).join("g").attr("transform", c => `translate(${c.px},${c.py})`).style("cursor", c => c.metro >= 0 ? "pointer" : "default");
  g.append("circle").attr("class", "outer").attr("r", 0).attr("fill", k.rain).attr("fill-opacity", c => c.metro >= 0 ? 0.28 : 0.18).attr("stroke", k.rain).attr("stroke-opacity", 0.7).attr("stroke-width", 1);
  g.append("circle").attr("class", "inner").attr("r", 0).attr("fill", k.rain).attr("fill-opacity", 0.9);
  g.append("circle").attr("class", "sel").attr("r", 0).attr("fill", "none").attr("stroke", k.ink).attr("stroke-width", 2).attr("stroke-dasharray", "4,3");
  const restyle = t => { const sel = t ? g.transition().duration(t) : g; sel.select("circle.outer").attr("r", rad); sel.select("circle.inner").attr("r", c => rS(shown >= 61 ? c.rain : Math.round(c.rain * c.cum[shown] / c.n))); g.select("circle.sel").attr("r", c => c.metro >= 0 && metros[c.metro] === state.city ? rad(c) + 5 : 0); };
  restyle(dur(800));
  svg.append("g").selectAll("text").data(placed.filter(c => metros.includes(c.city))).join("text").attr("class", "lab")
    .attr("x", c => c.city === "Las Vegas" ? c.px + rS(c.n) + 5 : c.px).attr("y", c => c.city === "Los Angeles" ? c.py + rS(c.n) + 13 : c.city === "Las Vegas" ? c.py + 4 : c.py - rS(c.n) - 6)
    .attr("text-anchor", c => c.city === "Las Vegas" ? "start" : "middle").text(c => c.city);
  g.on("mousemove", (ev, c) => showTip(ev, `<b>${c.city}, ${c.state}</b><br>${fmtN(c.n)} crash reports, ${c.rain} in rain${c.metro >= 0 ? `<br><span style="color:var(--muted)">tap to choose this city</span>` : `<br><span style="color:var(--muted)">too few reports to analyze the weather here</span>`}`)).on("mouseleave", hideTip)
    .on("click", (ev, c) => { if (c.metro >= 0) setState({city: metros[c.metro]}); });
  const btn = document.getElementById("mapPlay"); let playing = false;
  btn.onclick = () => {
    if (playing) return; playing = true; shown = 0; restyle(0); const per = dur(110) || 1;
    const t = d3.interval(() => { shown++; btn.textContent = new Date(2021, 6 + Math.min(shown, 61), 1).toLocaleString("en-US", {month: "short", year: "numeric"}) + ` · ${fmtN(d3.sum(placed, c => c.cum[Math.min(shown, 61)]))} reports so far`; restyle(per); if (shown >= 61) { t.stop(); playing = false; btn.textContent = "▶ Watch the fleets spread, 2021 to 2026"; } }, per);
  };
  return {select: () => restyle(0)};
}
let map = null;

// ---------- how your city compares: six small bars, tap to switch ----------
function renderCompare(f) {
  const k = C(), el = document.getElementById("vCompare"), W = Math.max(320, el.getBoundingClientRect().width || 900), rowH = 28, m = {left: 110, right: 150};
  const ex = DATA.exposure.slice().sort((a, b) => expectedOf(b) - expectedOf(a)), H = ex.length * rowH + 4;
  const x = d3.scaleLinear().domain([0, d3.max(ex, e => Math.round(expectedOf(e)))]).range([0, W - m.left - m.right]);
  const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", [0, 0, W, H]);
  const rows = svg.selectAll("g.crow").data(ex, e => e.metro).join(enter => {
    const g = enter.append("g").attr("class", "crow").attr("transform", (e, i) => `translate(0,${i * rowH + 2})`);
    g.append("rect").attr("class", "hit").attr("x", 0).attr("y", 0).attr("width", W).attr("height", rowH).attr("fill", "transparent");
    g.append("text").attr("class", "nm").attr("x", m.left - 10).attr("y", rowH / 2).attr("dy", "0.35em").attr("text-anchor", "end").style("font-size", "13px");
    g.append("rect").attr("class", "exp").attr("x", m.left).attr("y", 6).attr("height", rowH - 12).attr("rx", 4).attr("fill", "none").attr("stroke", k.rain).attr("stroke-width", 1.2).attr("stroke-dasharray", "3,2");
    g.append("rect").attr("class", "rep").attr("x", m.left).attr("y", 6).attr("height", rowH - 12).attr("rx", 4).attr("fill", k.rain);
    g.append("text").attr("class", "val").attr("y", rowH / 2).attr("dy", "0.35em").style("font-size", "12.5px");
    return g;
  });
  rows.select("text.nm").text(e => e.metro).style("font-weight", e => e.metro === state.city ? 700 : 500).style("fill", e => e.metro === state.city ? k.ink : k.text2);
  rows.select("rect.exp").attr("width", e => x(Math.round(expectedOf(e))));
  rows.select("rect.rep").transition().duration(dur(500)).attr("width", e => x(e.rainCrashes)).attr("fill-opacity", e => state.city === ALL || e.metro === state.city ? 1 : 0.45);
  rows.select("text.val").attr("x", e => m.left + x(Math.round(expectedOf(e))) + 8).style("fill", e => e.metro === state.city ? k.ink : k.muted).text(e => `${e.rainCrashes} of ${Math.round(expectedOf(e))} expected`);
  rows.on("click", (ev, e) => setState({city: e.metro})).on("mousemove", (ev, e) => showTip(ev, `<b>${e.metro}</b><br>${fmtN(e.crashes)} crashes, rain ${fmtP(e.rainHours)} of hours<br>${e.rainCrashes} rain crashes against ${Math.round(expectedOf(e))} expected`)).on("mouseleave", hideTip);
}

// ---------- the answer ----------
function renderAnswer(f) {
  const k = C();
  document.getElementById("h1").textContent = `Is it safe to take a robotaxi ${f.w === 2 ? "in the rain" : f.w === 1 ? "on a cloudy day" : "on a clear day"}${f.mi >= 0 ? " in " + f.city : ""}?`;
  document.getElementById("aWhere").innerHTML = `${ICON.pin}<span>${f.city}</span><span>·</span>${WICON[f.w]}<span>${WLABEL[f.w]}</span><span>·</span><span>${fmtN(f.n)} crash reports</span>`;
  const head = document.getElementById("aHead"), sub = document.getElementById("aSub"), sure = document.getElementById("aSure"), tiles = d3.select("#tiles");
  const tile = (icon, big, t, d, bg) => `<div class="tile"><div class="ic" style="background:${bg}">${icon}</div><div class="big">${big}</div><div class="t">${t}</div><div class="d">${d}</div></div>`;
  const rainIn100 = per100(f.inj[2].rate), clearIn100 = per100(f.inj[0].rate);
  if (f.w === 2) {
    if (!f.thin) {
      head.textContent = `Rain is not making these cars crash more in ${f.here}.`;
      sub.textContent = `If rain made no difference, ${f.here} would have had about ${f.predicted} rain crashes. There were ${f.reported}. The rain crashes that did happen were no worse than dry ones. The most likely reason is simple: the cars drive a lot less when it rains, so your bigger problem may be getting one.`;
      sure.className = "sure"; sure.innerHTML = `${ICON.check}<span>${f.excludesOne ? "Strong pattern: the gap is far too big to be chance" : "Clear pattern, but the count is small"}</span>`;
    } else {
      head.textContent = `${f.city} has had only ${f.reported === 1 ? "one rain crash" : f.reported + " rain crashes"}. That alone is the answer.`;
      sub.textContent = `There is too little to judge ${f.city} by itself, but it fits what every other city shows: fewer rain crashes than the weather predicts, no worse injuries, and a fleet that mostly stays in when it rains.`;
      sure.className = "sure warn"; sure.innerHTML = `${ICON.info}<span>Thin data here. The six-city pattern is the better guide.</span>`;
    }
    tiles.html(
      tile(ICON.rainDown, `${f.reported} <span style="font-size:18px;color:var(--muted)">of</span> ${f.predicted}`, "Fewer rain crashes than expected", `${f.reported} happened against about ${f.predicted} the weather alone predicts. That is ${fmt2(f.ratio)} of what you would expect if rain changed nothing.`, "var(--rainbg)") +
      tile(ICON.shield, f.inj[2].n >= 30 ? `${rainIn100} in 100` : "No sign", "Rain crashes are no worse", f.inj[2].n >= 30 ? `${rainIn100} of every 100 rain crashes injured someone, against ${clearIn100} of 100 in clear weather.` : `With ${f.inj[2].n} rain crash${f.inj[2].n === 1 ? "" : "es"} there is nothing pointing to worse injuries. Nationwide it is 7 in 100 in rain against 10 in clear weather.`, "var(--okbg)") +
      (f.thin
        ? tile(ICON.garage, "Six cities", "The cars are out less in rain", `Across all six cities, 91 rain crashes happened against about 187 expected. That fits a fleet driving about half as much when it rains, so expect fewer cars, not a riskier ride.`, "var(--cloudybg)")
        : tile(ICON.garage, "About half", "The cars are out less in rain", `The missing crashes fit a fleet driving roughly half as much when it rains. Expect longer waits and fewer cars, not a riskier ride.`, "var(--cloudybg)"))
    );
  } else {
    const i = f.inj[f.w], share = f.nW[f.w] / f.n;
    head.textContent = f.w === 0 ? `A clear day is the normal case. Nothing in the data points to extra risk.` : `A cloudy day looks like any other day in the data.`;
    sub.textContent = `${fmtP0(share)} of crashes in ${f.here} happened in ${f.wName} weather, because that is when the cars drive most. ${per100(i.rate)} of every 100 of them injured someone, about the same as the overall ${per100(f.injAll.rate)} in 100. The weather that people worry about is rain, and the data has something to say about that too.`;
    sure.className = "sure"; sure.innerHTML = `${ICON.check}<span>Based on ${fmtN(i.n)} ${f.wName} weather crashes</span>`;
    tiles.html(
      tile(WICON[f.w], fmtP0(share), `Most crashes happen in ${f.wName} weather`, `Because most driving does. A share of crashes is not a risk; it mostly mirrors where the cars are.`, f.w === 0 ? "var(--clearbg)" : "var(--cloudybg)") +
      tile(ICON.shield, `${per100(i.rate)} in 100`, "Injuries are rare", `${per100(i.rate)} of every 100 ${f.wName} weather crashes injured someone. Most reports are fender benders with no injury.`, "var(--okbg)") +
      tile(ICON.rain, `${f.reported} vs ${f.predicted}`, "Rain is the exception, in a good way", `Fewer rain crashes than the weather predicts, and no worse. Tap Rain above to see it.`, "var(--rainbg)")
    );
  }
}

// ---------- who is driving here ----------
const OPCOLOR = ["#2b6cd4", "#7c5cbf", "#e2a23b", "#3aa17e", "#c0564a", "#8a95a3", "#d98ac4", "#5aa9d6", "#aab3bd"];
function renderWho(f) {
  const counts = d3.rollups(f.rows, v => v.length, r => r[4]).map(([op, n]) => ({op, name: L.operators[op], n, share: n / f.n})).sort((a, b) => b.n - a.n);
  const top = counts[0], shown = counts.slice(0, 4), rest = d3.sum(counts.slice(4), d => d.n);
  const parts = [...shown, ...(rest ? [{op: 8, name: "Others", n: rest, share: rest / f.n}] : [])];
  document.getElementById("who").innerHTML = `
    <div class="wl">${ICON.car}<span>Who is driving ${f.mi >= 0 ? "here" : "these"}: mostly ${top.name}</span></div>
    <div class="wbar" title="share of crash reports by company">${parts.map(p => `<i style="width:${(p.share * 100).toFixed(1)}%;background:${OPCOLOR[Math.min(p.op, 8)]}" data-tip="${p.name}: ${fmtN(p.n)} reports, ${fmtP0(p.share)}"></i>`).join("")}</div>
    <div class="wkey">${parts.map(p => `<span style="--sw:${OPCOLOR[Math.min(p.op, 8)]}">${p.name} ${fmtP0(p.share)}</span>`).join("")}<span style="--sw:transparent;color:var(--muted)">share of crash reports, which mostly mirrors how many cars each company runs</span></div>`;
  d3.selectAll("#who .wbar i").on("mousemove", function (ev) { showTip(ev, `<b>${this.dataset.tip.split(":")[0]}</b><br>${this.dataset.tip.split(": ")[1]}`); }).on("mouseleave", hideTip);
}

// ---------- picture 1: expected against reported, as rings ----------
let miles = 1;
function renderRings(f) {
  const k = C(), el = document.getElementById("vRings"), W = Math.max(320, el.getBoundingClientRect().width || 900);
  const E0 = f.predicted, E = Math.round(d3.sum(f.mi >= 0 ? [DATA.exposure[f.mi]] : DATA.exposure, e => expectedOf(e)) * miles), R = f.reported;
  const total = Math.max(E, R, 1), ncol = Math.min(Math.max(8, Math.ceil(Math.sqrt(total * (W / 320)))), Math.floor(W / 22)), nrow = Math.ceil(total / ncol);
  const sp = Math.min(44, (W - 8) / ncol), rr = sp * 0.36, H = nrow * sp + 8;
  document.getElementById("icRings").innerHTML = ICON.rainDown;
  document.getElementById("t1").textContent = f.mi >= 0 ? `${f.city}: ${R} rain crashes happened, about ${E0} were expected` : `Six cities: ${R} rain crashes happened, about ${E0} were expected`;
  document.getElementById("k1").textContent = R < E0 ? `Every empty ring is a rain crash that the weather predicted and that never got reported.` : `Reported crashes match or exceed the weather's prediction here.`;
  const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", [0, 0, W, H]);
  const dots = svg.selectAll("circle").data(d3.range(total), d => d);
  dots.join(enter => enter.append("circle").attr("r", 0).attr("cx", j => (j % ncol) * sp + sp / 2 + 4).attr("cy", j => Math.floor(j / ncol) * sp + sp / 2 + 4), update => update, exit => exit.transition().duration(dur(300)).attr("r", 0).remove())
    .attr("stroke", k.rain).attr("stroke-width", 1.5)
    .on("mousemove", (ev, j) => showTip(ev, j < R ? `<b>A rain crash that happened</b><br>one of ${R} reported` : `<b>A rain crash the weather predicted</b><br>but none was reported`)).on("mouseleave", hideTip)
    .transition().duration(dur(500)).delay((j) => dur(Math.min(600, j * 4)))
    .attr("cx", j => (j % ncol) * sp + sp / 2 + 4).attr("cy", j => Math.floor(j / ncol) * sp + sp / 2 + 4).attr("r", rr)
    .attr("fill", j => j < R ? k.rain : "none");
  document.getElementById("milesHint").textContent = miles < 1 ? `At ${fmtP0(miles)} of usual driving the weather would predict ${E}; ${R} happened.` : "Slide left until the empty rings disappear.";
}
const slider = document.getElementById("miles"), milesLbl = document.getElementById("milesLbl");
slider.addEventListener("input", () => { miles = +slider.value / 100; milesLbl.textContent = slider.value + "%"; renderRings(facts()); });

// ---------- picture 2: out of 100 crashes, how many injured someone ----------
function person(x, y, s, fill, stroke) { return `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}" stroke="${stroke}" stroke-width="${stroke === "none" ? 0 : 1.2}"><circle cx="6" cy="3" r="2.6"/><path d="M1.5 16V9.5a2.5 2.5 0 0 1 2.5-2.5h4a2.5 2.5 0 0 1 2.5 2.5V16h-2v-4h-1v8H4.5v-8h-1v4z"/></g>`; }
function renderPeople(f) {
  const k = C(), el = document.getElementById("vPeople"), W = Math.max(280, el.getBoundingClientRect().width || 800) - (window.innerWidth > 760 ? 134 : 0);
  document.getElementById("icInjury").innerHTML = ICON.shield;
  const rainOk = f.inj[2].n >= 30;
  document.getElementById("t2").textContent = rainOk ? `Out of 100 crashes, ${per100(f.inj[2].rate)} injured someone in rain, ${per100(f.inj[0].rate)} in clear weather` : `Out of 100 crashes, about ${per100(f.injAll.rate)} injured someone, whatever the weather`;
  document.getElementById("k2").textContent = rainOk ? `Rain crashes are not worse. If anything they are milder, though the rain count is small.` : `${f.city} has too few rain crashes to compare on its own; nationwide rain is 7 in 100 against 10 in clear weather.`;
  const rows = [0, 1, 2].map(w => ({w, ...f.inj[w]}));
  const cols = 25, cw = W / cols, s = Math.min(1.5, cw / 13), rowH = 23 * s * 4 + 10;
  const html = rows.map(r => {
    const filled = per100(r.rate), color = [k.clear, k.cloudy, k.rain][r.w], on = r.w === f.w;
    const people = d3.range(100).map(j => person((j % cols) * cw, Math.floor(j / cols) * 23 * s, s, j < filled ? color : "none", j < filled ? "none" : (on ? color : k.gray))).join("");
    return `<div class="prow" style="opacity:${on || r.n >= 10 ? 1 : 0.55}"><div class="pl">${WLABEL[r.w]}<small>${r.n ? `${r.k} of ${fmtN(r.n)} crashes · ${fmtP0(r.ci[0])} to ${fmtP0(r.ci[1])}` : "no crashes"}</small></div><svg viewBox="0 0 ${W} ${rowH - 10}" aria-label="${filled} of 100 ${WNAME[r.w]} crashes injured someone"><title>${filled} of 100 ${WNAME[r.w]} weather crashes injured someone</title>${people}</svg></div>`;
  }).join("");
  el.innerHTML = html;
  document.getElementById("h2note").textContent = "Each figure is one crash in a hundred; a filled figure means someone was hurt. The range under each weather is how far the true rate could reasonably be, given how many crashes there were.";
}

// ---------- picture 3: do they drive in the rain at all ----------
let series = "rain";
function renderMonths(f) {
  const k = C(), el = document.getElementById("vMonths"), W = Math.max(320, el.getBoundingClientRect().width || 900), H = Math.min(360, Math.max(220, W * 0.36)), m = {top: W < 600 ? 40 : 30, right: 50, bottom: 30, left: 44};
  const md = f.mo, rows = md.rows;
  const months = d3.range(0, 61).map(i => { const y = 2021 + Math.floor((i + 6) / 12), mo = (i + 6) % 12 + 1; return `${y}-${String(mo).padStart(2, "0")}`; });
  document.getElementById("icMonths").innerHTML = ICON.calendar;
  const r = md.rRain, nRain = d3.sum(rows, x => x.rain), strong = r >= 0.4, faint = r >= 0.15;
  document.getElementById("t3").textContent = strong ? `In ${f.moName}, rainy months bring more rain crashes, so the cars are out there` : faint ? `In ${f.city}, rain crashes lean toward the rainy months, but only faintly` : `${f.city} has had ${nRain === 1 ? "one rain crash" : nRain + " rain crashes"}: too few to show a season either way`;
  document.getElementById("k3").textContent = strong ? `They just drive less of it. If the fleet were parked whenever it rained, the dots would not follow the bars at all.` : faint ? `With ${nRain} rain crashes the pattern is weak here. San Francisco, with the most data, shows it clearly: the cars do go out in the rain.` : `Where there is enough data, San Francisco above all, rain crashes rise and fall with the rainy months, so the cars are out there, just less.`;
  document.getElementById("h3note").textContent = (md.summed ? "Months are summed across the six cities. " : "") + `Gray bars are hours of rain in the month. Each blue dot is one rain crash. Hover a month.`;
  const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", [0, 0, W, H]);
  svg.selectAll("*").remove();
  const x = d3.scaleBand().domain(months).range([m.left, W - m.right]).padding(0.2);
  const yb = d3.scaleLinear().domain([0, d3.max(rows, x => x.rainHours) || 1]).nice().range([H - m.bottom, m.top]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`).call(d3.axisBottom(x).tickValues(months.filter(mo => mo.endsWith("-01"))).tickFormat(mo => mo.slice(0, 4))).select(".domain").remove();
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(yb).ticks(4)).select(".domain").remove();
  svg.append("text").attr("x", m.left).attr("y", 14).style("font-size", "12px").style("fill", k.muted).text("hours of rain each month (bars) and rain crashes (one dot each)");
  svg.append("text").attr("x", W < 600 ? m.left : W - m.right).attr("y", W < 600 ? 28 : 14).attr("text-anchor", W < 600 ? "start" : "end").style("font-size", "12.5px").style("font-weight", 600).style("fill", k.rain).text(strong ? `they move together: r = ${r.toFixed(2)}` : `r = ${r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}`);
  svg.append("g").selectAll("rect").data(rows).join("rect").attr("x", d => x(d.month)).attr("width", x.bandwidth()).attr("y", d => yb(d.rainHours)).attr("height", d => H - m.bottom - yb(d.rainHours)).attr("fill", k.bar);
  const dotR = Math.min(4.5, x.bandwidth() * 0.6), step = dotR * 2 + 1.5;
  svg.append("g").selectAll("circle").data(rows.flatMap(d => d3.range(d.rain).map(j => ({d, j})))).join("circle").attr("cx", d => x(d.d.month) + x.bandwidth() / 2).attr("cy", d => H - m.bottom - dotR - 1 - d.j * step).attr("r", dotR).attr("fill", k.rain);
  svg.append("g").selectAll("rect").data(rows).join("rect").attr("x", d => x(d.month)).attr("width", x.bandwidth()).attr("y", m.top).attr("height", H - m.top - m.bottom).attr("fill", "transparent")
    .on("mousemove", (ev, x) => showTip(ev, `<b>${x.month}</b><br>${fmtN(x.rainHours)} hours of rain${md.summed ? " across the six cities" : ""}<br>${x.crashes} crashes, ${x.rain} in rain`)).on("mouseleave", hideTip);
}

// ---------- render everything ----------
function render() {
  d3.selectAll("#cityPick button").classed("on", d => d === state.city);
  d3.selectAll("#wxPick button").classed("on", (d, i) => i === state.w);
  const f = facts();
  document.getElementById("wxNote").textContent = f.w === 2 ? "Rain is the weather people worry about, and the one the data can test." : `${WLABEL[f.w]} is the everyday case. Pick Rain to see the comparison people ask about.`;
  if (!map) map = buildMap(); else map.select();
  document.body.dataset.w = state.w;
  renderAnswer(f); renderWho(f); renderRings(f); renderCompare(f); renderPeople(f); renderMonths(f);
}
render();
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { map = null; render(); }, 150); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);

}).catch(err => { console.error(err); const a = document.getElementById('aHead'); if (a) a.textContent = 'The data could not be loaded.'; });
})();

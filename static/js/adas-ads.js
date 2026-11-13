(() => {
  "use strict";

  const ADAS_FILE = "/static/data/SGO-2021-01_Incident_Reports_ADAS.csv";
  const ADS_FILE = "/static/data/SGO-2021-01_Incident_Reports_ADS.csv";

  const COLOR_ADAS = "var(--rain)";
  const COLOR_ADS = "var(--clear)";

  const container = document.getElementById("container");

  async function processData() {
    const [adasData, adsData] = await Promise.all([
      d3.csv(ADAS_FILE),
      d3.csv(ADS_FILE),
    ]);
    console.log(
      `Loaded ${adasData.length} ADAS reports and ${adsData.length} ADS reports`,
    );
    buildDashboard(adasData, adsData);
  }

  // Normalize make names so e.g. "Tesla" and "TESLA" are treated as one brand
  function normalizeMake(make) {
    return ((make || "").trim() || "Unknown").toUpperCase();
  }

  // Parse a report date (MMM-YYYY, e.g. "MAR-2026") into a Date (1st of month).
  // Falls back to Report Submission Date when Incident Date is blank.
  function parseReportDate(d) {
    const raw = d["Incident Date"] || d["Report Submission Date"];
    if (!raw) return null;
    return d3.timeParse("%b-%Y")(raw);
  }

  function createHeader() {
    const header = document.createElement("div");
    header.className = "adas-header hero";
    header.innerHTML = `
      <h1>NHTSA ADAS & ADS Incident Reports by Vehicle Brand</h1>
      <h2>Crashes by Vehicle Brand — ADAS vs ADS</h2>
    `;
    return header;
  }

  function createFilterBar(top5Makes) {
    const filterBar = document.createElement("div");
    filterBar.className = "make-filter q";
    filterBar.innerHTML = `
      <label for="make-filter">Filter by make:</label>
      <select id="make-filter"></select>
    `;

    const select = filterBar.querySelector("#make-filter");
    select.innerHTML =
      '<option value="None">None</option>' +
      top5Makes.map((m) => `<option value="${m}">${m}</option>`).join("");

    return filterBar;
  }

  // Count crashes by make for each automation system
  function getMakeCounts(adasData, adsData) {
    const adasCounts = d3.rollup(
      adasData,
      (g) => g.length,
      (d) => normalizeMake(d.Make),
    );
    const adsCounts = d3.rollup(
      adsData,
      (g) => g.length,
      (d) => normalizeMake(d.Make),
    );
    return { adasCounts, adsCounts };
  }

  function buildMakeData(adasCounts, adsCounts) {
    const allMakes = new Set([...adasCounts.keys(), ...adsCounts.keys()]);
    const data = Array.from(allMakes, (make) => ({
      make,
      adas: adasCounts.get(make) || 0,
      ads: adsCounts.get(make) || 0,
    }));
    // Sort by total crashes descending
    data.sort((a, b) => b.adas + b.ads - (a.adas + a.ads));
    return data;
  }

  // Combine both datasets, tagging each row with its automation system
  function combineRows(adasData, adsData) {
    return [
      ...adasData.map((d) => ({ ...d, system: "ADAS" })),
      ...adsData.map((d) => ({ ...d, system: "ADS" })),
    ];
  }

  function createSvgCard(parent, className, width, height) {
    const card = document.createElement("div");
    card.className = className;
    parent.appendChild(card);

    const svg = d3.create("svg").attr("viewBox", [0, 0, width, height]);
    card.appendChild(svg.node());
    return svg;
  }

  function buildDashboard(adasData, adsData) {
    container.innerHTML = "";

    container.appendChild(createHeader());

    const { adasCounts, adsCounts } = getMakeCounts(adasData, adsData);
    const data = buildMakeData(adasCounts, adsCounts);

    // Bar chart: top 10 brands
    const barData = data.slice(0, 10);
    // Timeseries: top 5 brands
    const top5Makes = data.slice(0, 5).map((d) => d.make);

    // Dropdown to filter both charts by vehicle make (placed at the top)
    const filterBar = createFilterBar(top5Makes);
    container.appendChild(filterBar);
    const select = filterBar.querySelector("#make-filter");

    // ---- Bar chart card ----
    const barSvg = createSvgCard(
      container,
      "chart-card grouped-chart",
      1100,
      620,
    );

    // ---- Timeseries chart card ----
    const tsCard = document.createElement("div");
    tsCard.className = "chart-card";
    container.appendChild(tsCard);

    const tsHeader = document.createElement("h3");
    tsHeader.textContent = "Monthtly Record of Incidents";
    tsCard.appendChild(tsHeader);

    const tsSvg = d3.create("svg").attr("viewBox", [0, 0, 1100, 420]);
    tsCard.appendChild(tsSvg.node());

    // Only the top 10 brands appear in the timeseries
    const top10Makes = new Set(barData.map((d) => d.make));
    const allRows = combineRows(adasData, adsData).filter((d) =>
      top10Makes.has(normalizeMake(d.Make)),
    );

    function renderGroupedBar(selectedMake) {
      // "None" = show top 10; otherwise filter to just the chosen make
      const filtered =
        selectedMake === "None"
          ? barData
          : barData.filter((d) => d.make === selectedMake);
      plotGroupedBar(barSvg, filtered, { width: 1100, height: 620 });
    }

    function renderTimeseries(selectedMake) {
      // null = show all; otherwise show only the chosen make
      plotTimeseries(
        tsSvg,
        allRows,
        selectedMake === "None" ? null : selectedMake,
        { width: 1100, height: 420 },
      );
    }

    select.addEventListener("change", (event) => {
      const value = event.target.value;
      renderGroupedBar(value);
      renderTimeseries(value);
    });

    // Initial render: no filter in both charts
    renderGroupedBar("None");
    renderTimeseries("None");
  }

  // Grouped (not stacked) bar chart: one group per brand, one bar per system
  function plotGroupedBar(svg, data, { width, height }) {
    svg.selectAll("*").remove();

    const margin = { top: 50, right: 40, bottom: 130, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const series = ["ADAS", "ADS"];
    const colors = { ADAS: COLOR_ADAS, ADS: COLOR_ADS };

    // X scale: bands for each brand
    const x0 = d3
      .scaleBand()
      .domain(data.map((d) => d.make))
      .range([0, innerWidth])
      .paddingInner(0.18)
      .paddingOuter(0.08);

    // X scale: bands for the two series within each brand group
    const x1 = d3
      .scaleBand()
      .domain(series)
      .range([0, x0.bandwidth()])
      .padding(0.08);

    // Y scale: crash count (linear, not stacked)
    const yMax = d3.max(data, (d) => Math.max(d.adas, d.ads));
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y axis
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(8).tickFormat(d3.format(",d")))
      .call((g) => g.select(".domain").remove());

    g.append("text")
      .attr("x", -margin.left + 4)
      .attr("y", -22)
      .attr("fill", "var(--ink)")
      .attr("text-anchor", "start")
      .attr("font-weight", "bold")
      .text("Number of Crashes");

    // ADAS bars (blue)
    g.append("g")
      .attr("fill", COLOR_ADAS)
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("class", "bar adas")
      .attr("x", (d) => x0(d.make) + x1("ADAS"))
      .attr("y", (d) => y(d.adas))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => innerHeight - y(d.adas));

    // ADS bars (orange)
    g.append("g")
      .attr("fill", COLOR_ADS)
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("class", "bar ads")
      .attr("x", (d) => x0(d.make) + x1("ADS"))
      .attr("y", (d) => y(d.ads))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => innerHeight - y(d.ads));

    // Value labels on top of each non-zero bar
    const adasLabels = data.filter((d) => d.adas > 0);
    const adsLabels = data.filter((d) => d.ads > 0);

    g.append("g")
      .attr("fill", "var(--text2)")
      .attr("font-size", "9px")
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(adasLabels)
      .join("text")
      .attr("x", (d) => x0(d.make) + x1("ADAS") + x1.bandwidth() / 2)
      .attr("y", (d) => y(d.adas) - 6)
      .text((d) => d.adas);

    g.append("g")
      .attr("fill", "var(--text2)")
      .attr("font-size", "9px")
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(adsLabels)
      .join("text")
      .attr("x", (d) => x0(d.make) + x1("ADS") + x1.bandwidth() / 2)
      .attr("y", (d) => y(d.ads) - 6)
      .text((d) => d.ads);

    // X axis (brand names)
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0))
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end")
      .attr("font-size", "10px");

    // Axis title
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 105)
      .attr("fill", "var(--ink)")
      .attr("font-size", "12px")
      .attr("text-anchor", "middle")
      .text("Vehicle Brand (Make)");

    // Legend
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width - margin.right - 100},${margin.top / 2})`,
      );

    series.forEach((s, i) => {
      const row = legend
        .append("g")
        .attr("transform", `translate(0,${i * 24})`);
      row
        .append("rect")
        .attr("width", 16)
        .attr("height", 16)
        .attr("fill", colors[s]);
      row
        .append("text")
        .attr("x", 20)
        .attr("y", 12)
        .attr("fill", "var(--ink)")
        .attr("font-size", "13px")
        .text(s === "ADAS" ? "ADAS crashes" : "ADS crashes");
    });
  }

  // Timeseries line chart: monthly incidents, optionally filtered to one make
  function plotTimeseries(svg, rows, selectedMake, { width, height }) {
    // Clear any previously drawn content (allows re-rendering on filter change)
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 130, bottom: 160, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // When a specific make is chosen, only include that make; otherwise include all.
    const selectedMakes = selectedMake ? new Set([selectedMake]) : null;

    // Aggregate incidents per brand per month (YYYY-MM key)
    const brandMonths = new Map(); // make -> Map(monthKey -> count)
    let minDate = null;
    let maxDate = null;

    for (const row of rows) {
      const make = normalizeMake(row.Make);
      if (selectedMakes && !selectedMakes.has(make)) continue;
      const date = parseReportDate(row);
      if (!date) continue;
      const key = d3.timeFormat("%Y-%m")(date);
      if (!brandMonths.has(make)) brandMonths.set(make, new Map());
      const m = brandMonths.get(make);
      m.set(key, (m.get(key) || 0) + 1);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    if (!minDate || !maxDate) {
      const msg = selectedMake
        ? `No incident dates available for "${selectedMake}".`
        : "No incident dates available.";
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--muted)")
        .attr("font-size", "14px")
        .text(msg);
      return;
    }

    // One point per month (1st of month) across the full range so lines sit at 0
    // when a brand had no incidents in a given month.
    const allMonths = d3.timeMonths(
      d3.timeMonth.floor(minDate),
      d3.timeMonth.offset(d3.timeMonth.ceil(maxDate), 1),
    );

    const series = Array.from(brandMonths.keys())
      .sort()
      .map((make) => {
        const counts = brandMonths.get(make) || new Map();
        return {
          make,
          points: allMonths.map((date) => ({
            date,
            count: counts.get(d3.timeFormat("%Y-%m")(date)) || 0,
          })),
        };
      });

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale: time
    const x = d3
      .scaleTime()
      .domain([d3.timeMonth.floor(minDate), d3.timeMonth.offset(maxDate, 1)])
      .range([0, innerWidth]);

    // Y scale: incident count
    const yMax = d3.max(series, (s) => d3.max(s.points, (p) => p.count));
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    // X axis (month)
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeMonth.every(1))
          .tickFormat(d3.timeFormat("%b %Y")),
      )
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end")
      .attr("font-size", "9px");

    // Y axis
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(",d")))
      .call((g) => g.select(".domain").remove());

    // X axis title
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 80)
      .attr("fill", "var(--ink)")
      .attr("font-size", "12px")
      .attr("text-anchor", "middle")
      .text("Incident Month");

    // Color scale for brands
    const color = d3
      .scaleOrdinal()
      .domain(series.map((s) => s.make))
      .range(d3.schemeCategory10);

    // Line generator
    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.count));

    // Lines (one per brand)
    g.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .selectAll("path")
      .data(series)
      .join("path")
      .attr("stroke", (s) => color(s.make))
      .attr("d", (s) => line(s.points));

    // Dots at each monthly point
    g.append("g")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 3.5)
      .selectAll("g")
      .data(series)
      .join("g")
      .attr("stroke", (s) => color(s.make))
      .selectAll("line")
      .data((s) => s.points.map((p) => ({ ...p, make: s.make })))
      .join("line")
      .attr("x1", (d) => x(d.date) - 2.5)
      .attr("x2", (d) => x(d.date) + 2.5)
      .attr("y1", (d) => y(d.count))
      .attr("y2", (d) => y(d.count));

    // Legend (below the chart, right side)
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width - margin.right + 20},${margin.top + innerHeight - 190})`,
      );

    series.forEach((s, i) => {
      const row = legend
        .append("g")
        .attr("transform", `translate(0,${i * 18})`);
      row
        .append("line")
        .attr("x1", 0)
        .attr("x2", 16)
        .attr("y1", 10)
        .attr("y2", 10)
        .attr("stroke", color(s.make))
        .attr("stroke-width", 3);
      row
        .append("text")
        .attr("x", 22)
        .attr("y", 12)
        .attr("fill", "var(--ink)")
        .attr("font-size", "12px")
        .text(s.make);
    });
  }

  processData();
})();

(() => {
  'use strict';

  const ADAS_FILE = '/static/data/SGO-2021-01_Incident_Reports_ADAS.csv';
  const ADS_FILE = '/static/data/SGO-2021-01_Incident_Reports_ADS.csv';

  const COLOR_ADAS = '#1f77b4'; // blue
  const COLOR_ADS = '#ff7f0e'; // orange

  const container = document.getElementById('container');

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
    return ((make || '').trim() || 'Unknown').toUpperCase();
  }

  // Parse a report date (MMM-YYYY, e.g. "MAR-2026") into a Date (1st of month).
  // Falls back to Report Submission Date when Incident Date is blank.
  function parseReportDate(d) {
    const raw = d['Incident Date'] || d['Report Submission Date'];
    if (!raw) return null;
    return d3.timeParse('%b-%Y')(raw);
  }

  function buildDashboard(adasData, adsData) {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'dashboard-header';
    header.innerHTML = `
      <h2>Crashes by Vehicle Brand — ADAS vs ADS</h2>
      <p style="margin:4px 0 0 0;font-size:13px;color:#555;">
        NHTSA Standing General Order 2021-01 incident reports &nbsp;|&nbsp;
        grouped bar chart (top 10 brands) plus monthly timeseries (top 5 brands)
      </p>
    `;
    container.appendChild(header);

    // Dropdown to filter both charts by vehicle make (placed at the top)
    const filterBar = document.createElement('div');
    filterBar.className = 'make-filter';
    filterBar.style.marginBottom = '16px';
    filterBar.style.padding = '10px 14px';
    filterBar.style.background = '#fff';
    filterBar.style.border = '1px solid #e5e5e5';
    filterBar.style.borderRadius = '8px';
    filterBar.innerHTML = `
      <label for="make-filter" style="font-size:13px;font-weight:600;margin-right:8px;">Filter by make:</label>
      <select id="make-filter" style="padding:6px 10px;font-size:13px;"></select>
    `;
    container.appendChild(filterBar);

    // Count crashes by make for each automation system
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

    const allMakes = new Set([...adasCounts.keys(), ...adsCounts.keys()]);
    let data = Array.from(allMakes, (make) => ({
      make,
      adas: adasCounts.get(make) || 0,
      ads: adsCounts.get(make) || 0,
    }));
    // Sort by total crashes descending
    data.sort((a, b) => b.adas + b.ads - (a.adas + a.ads));

    // Bar chart: top 10 brands
    const barData = data.slice(0, 10);

    // Timeseries: top 5 brands
    const top5 = data.slice(0, 5);

    // ---- Bar chart card ----
    const barCard = document.createElement('div');
    barCard.className = 'chart-card grouped-chart';
    container.appendChild(barCard);

    const barSvg = d3
      .create('svg')
      .attr('viewBox', [0, 0, 1100, 620])
      .attr(
        'style',
        'max-width:100%; height:auto; display:block; margin:0 auto;',
      );
    barCard.appendChild(barSvg.node());

    function renderGroupedBar(selectedMake) {
      // "All" = show top 10; otherwise filter to just the chosen make
      const filtered =
        selectedMake === 'All'
          ? barData
          : barData.filter((d) => d.make === selectedMake);
      barSvg.selectAll('*').remove();
      plotGroupedBar(barSvg, filtered, { width: 1100, height: 620 });
    }

    plotGroupedBar(barSvg, barData, { width: 1100, height: 620 });

    // ---- Timeseries chart card ----
    const tsCard = document.createElement('div');
    tsCard.className = 'chart-card';
    container.appendChild(tsCard);

    const tsHeader = document.createElement('h3');
    tsHeader.textContent =
      'NHTSA Monthtly Record of ADAS and ADS Incidents (2021 - 2026)';
    tsCard.appendChild(tsHeader);

    const tsSvg = d3
      .create('svg')
      .attr('viewBox', [0, 0, 1100, 420])
      .attr(
        'style',
        'max-width:100%; height:auto; display:block; margin:0 auto;',
      );
    tsCard.appendChild(tsSvg.node());

    // Combine both datasets, tagging each row with its automation system
    const allRows = [
      ...adasData.map((d) => ({ ...d, system: 'ADAS' })),
      ...adsData.map((d) => ({ ...d, system: 'ADS' })),
    ];

    // Build dropdown options: "All makes" plus only the top 5 makes
    const select = filterBar.querySelector('#make-filter');
    const top5Makes = top5.map((d) => d.make);
    select.innerHTML =
      '<option value="All">All makes</option>' +
      top5Makes.map((m) => `<option value="${m}">${m}</option>`).join('');

    function renderTimeseries(selectedMake) {
      // null = show all; otherwise show only the chosen make
      plotTimeseries(
        tsSvg,
        allRows,
        selectedMake === 'All' ? null : selectedMake,
        { width: 1100, height: 420 },
      );
    }

    select.addEventListener('change', (event) => {
      const value = event.target.value;
      renderGroupedBar(value);
      renderTimeseries(value);
    });

    // Initial render: show all makes in both charts
    renderGroupedBar('All');
    renderTimeseries('All');
  }

  // Grouped (not stacked) bar chart: one group per brand, one bar per system
  function plotGroupedBar(svg, data, { width, height }) {
    const margin = { top: 50, right: 40, bottom: 130, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const series = ['ADAS', 'ADS'];
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
    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([innerHeight, 0]);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(8).tickFormat(d3.format(',d')))
      .call((g) => g.select('.domain').remove());

    g.append('text')
      .attr('x', -margin.left + 4)
      .attr('y', -22)
      .attr('fill', '#333')
      .attr('font-size', '12px')
      .attr('text-anchor', 'start')
      .text('Number of Crashes');

    // ADAS bars (blue)
    g.append('g')
      .attr('fill', COLOR_ADAS)
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('class', 'bar adas')
      .attr('x', (d) => x0(d.make) + x1('ADAS'))
      .attr('y', (d) => y(d.adas))
      .attr('width', x1.bandwidth())
      .attr('height', (d) => innerHeight - y(d.adas));

    // ADS bars (orange)
    g.append('g')
      .attr('fill', COLOR_ADS)
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('class', 'bar ads')
      .attr('x', (d) => x0(d.make) + x1('ADS'))
      .attr('y', (d) => y(d.ads))
      .attr('width', x1.bandwidth())
      .attr('height', (d) => innerHeight - y(d.ads));

    // Value labels on top of each non-zero bar
    const adasLabels = data.filter((d) => d.adas > 0);
    const adsLabels = data.filter((d) => d.ads > 0);

    g.append('g')
      .attr('fill', '#333')
      .attr('font-size', '9px')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(adasLabels)
      .join('text')
      .attr('x', (d) => x0(d.make) + x1('ADAS') + x1.bandwidth() / 2)
      .attr('y', (d) => y(d.adas) - 6)
      .text((d) => d.adas);

    g.append('g')
      .attr('fill', '#333')
      .attr('font-size', '9px')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(adsLabels)
      .join('text')
      .attr('x', (d) => x0(d.make) + x1('ADS') + x1.bandwidth() / 2)
      .attr('y', (d) => y(d.ads) - 6)
      .text((d) => d.ads);

    // X axis (brand names)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end')
      .attr('font-size', '10px');

    // Axis title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 105)
      .attr('fill', '#333')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .text('Vehicle Brand (Make)');

    // Legend
    const legend = svg
      .append('g')
      .attr(
        'transform',
        `translate(${width - margin.right - 160},${margin.top / 2})`,
      );

    series.forEach((s, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 24})`);
      row
        .append('rect')
        .attr('width', 16)
        .attr('height', 16)
        .attr('fill', colors[s]);
      row
        .append('text')
        .attr('x', 20)
        .attr('y', 12)
        .attr('fill', '#222')
        .attr('font-size', '13px')
        .text(s === 'ADAS' ? 'ADAS crashes' : 'ADS crashes');
    });
  }

  // Timeseries line chart: monthly incidents, optionally filtered to one make
  function plotTimeseries(svg, rows, selectedMake, { width, height }) {
    // Clear any previously drawn content (allows re-rendering on filter change)
    svg.selectAll('*').remove();

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
      const key = d3.timeFormat('%Y-%m')(date);
      if (!brandMonths.has(make)) brandMonths.set(make, new Map());
      const m = brandMonths.get(make);
      m.set(key, (m.get(key) || 0) + 1);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }

    if (!minDate || !maxDate) {
      const msg = selectedMake
        ? `No incident dates available for "${selectedMake}".`
        : 'No incident dates available.';
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '14px')
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
            count: counts.get(d3.timeFormat('%Y-%m')(date)) || 0,
          })),
        };
      });

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale: time
    const x = d3
      .scaleTime()
      .domain([d3.timeMonth.floor(minDate), d3.timeMonth.offset(maxDate, 1)])
      .range([0, innerWidth]);

    // Y scale: incident count
    const yMax = d3.max(series, (s) => d3.max(s.points, (p) => p.count));
    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([innerHeight, 0]);

    // X axis (month)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeMonth.every(1))
          .tickFormat(d3.timeFormat('%b %Y')),
      )
      .selectAll('text')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end')
      .attr('font-size', '9px');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(',d')))
      .call((g) => g.select('.domain').remove());

    // X axis title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 60)
      .attr('fill', '#333')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .text('Incident Month');

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
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .selectAll('path')
      .data(series)
      .join('path')
      .attr('stroke', (s) => color(s.make))
      .attr('d', (s) => line(s.points));

    // Dots at each monthly point
    g.append('g')
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', 3.5)
      .selectAll('g')
      .data(series)
      .join('g')
      .attr('stroke', (s) => color(s.make))
      .selectAll('line')
      .data((s) => s.points.map((p) => ({ ...p, make: s.make })))
      .join('line')
      .attr('x1', (d) => x(d.date) - 2.5)
      .attr('x2', (d) => x(d.date) + 2.5)
      .attr('y1', (d) => y(d.count))
      .attr('y2', (d) => y(d.count));

    // Legend (below the chart, right side)
    const legend = svg
      .append('g')
      .attr(
        'transform',
        `translate(${width - margin.right + 8},${margin.top + innerHeight + 68})`,
      );

    series.forEach((s, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 18})`);
      row
        .append('line')
        .attr('x1', 0)
        .attr('x2', 16)
        .attr('y1', 10)
        .attr('y2', 10)
        .attr('stroke', color(s.make))
        .attr('stroke-width', 3);
      row
        .append('text')
        .attr('x', 22)
        .attr('y', 12)
        .attr('fill', '#222')
        .attr('font-size', '12px')
        .text(s.make);
    });
  }

  processData();
})();

/* global d3 */
(() => {
  'use strict';
  const colors = { rate: '#7b6099', crashes: '#426b9a', miles: '#36857a' };
  const fmtCount = d3.format(',');
  let data, baseline, selected = null;
  const quarterChart = d3.select('#quarterly-chart');
  const trajectoryChart = d3.select('#trajectory-chart');

  function selectQuarter(d) {
    selected = d;
    d3.select('#selected-values').html(d
      ? `<strong>${d.quarter}</strong><span>${fmtCount(d.crashes)} reported crashes</span><span>${d.miles_millions.toFixed(2)} million miles</span><span>${d.rate.toFixed(2)} crashes / million miles</span>`
      : '<span class="prompt">Select a quarter to highlight its count, mileage, and rate.</span>');
    d3.selectAll('.bar').attr('opacity', q => !selected || q.quarter === selected.quarter ? 1 : 0.45);
    d3.selectAll('.point').attr('r', q => selected && q.quarter === selected.quarter ? 7 : 5);
    if (d) {
      const difference = (d.rate / baseline.rate - 1) * 100;
      const description = Math.abs(difference) < 0.05 ? 'the same rate as' : `${Math.abs(difference).toFixed(1)}% ${difference < 0 ? 'fewer' : 'more'} reported crashes per mile than`;
      d3.select('#comparison-readout').text(`${d.quarter}: ${d.rate.toFixed(2)} reported crashes per million miles — ${description} ${baseline.quarter}.`);
    }
  }

  function setBaseline(d) {
    baseline = d;
    d3.select('#baseline-quarter').property('value', d.quarter);
    renderTrajectory();
    selectQuarter(d);
  }

  function renderQuarterly() {
    quarterChart.selectAll('*').remove();
    const width = Math.max(300, quarterChart.node().clientWidth);
    const compact = width < 600;
    const margin = { left: 52, right: 12, top: 32, bottom: 33 };
    const panelHeight = compact ? 150 : 155;
    const gap = 24;
    const height = margin.top + panelHeight * 3 + gap * 2 + margin.bottom;
    const x = d3.scaleBand().domain(data.map(d => d.quarter)).range([margin.left, width - margin.right]).padding(0.36);
    const svg = quarterChart.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'Quarterly crashes, miles, and crash rates');
    const panels = [
      { key: 'rate', title: 'Reported crashes per million miles', color: colors.rate, format: d => d.toFixed(2) },
      { key: 'crashes', title: 'Reported crashes', color: colors.crashes, format: fmtCount },
      { key: 'miles_millions', title: 'Miles driven (millions)', color: colors.miles, format: d => d.toFixed(1) },
    ];
    panels.forEach((panel, index) => {
      const offset = margin.top + index * (panelHeight + gap);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => d[panel.key]) * 1.12]).nice(4).range([panelHeight, 0]);
      const g = svg.append('g').attr('transform', `translate(0,${offset})`);
      g.append('text').attr('class', 'panel-title').attr('x', margin.left).attr('y', -14).text(panel.title);
      g.append('g').attr('class', 'grid').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(width - margin.left - margin.right)).tickFormat(''));
      g.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      const boundary = (x('2025 Q2') + x.bandwidth() + x('2025 Q3')) / 2;
      g.append('line').attr('x1', boundary).attr('x2', boundary).attr('y1', 0).attr('y2', panelHeight).attr('stroke', '#b08b4b').attr('stroke-dasharray', '3,4').attr('opacity', .7);
      if (index === 0 && !compact) g.append('text').attr('class', 'boundary-label').attr('x', boundary + 7).attr('y', 10).text('Reporting change');
      const bars = g.selectAll('.bar').data(data).join('rect').attr('class', 'bar').attr('x', d => x(d.quarter)).attr('y', d => y(d[panel.key])).attr('width', x.bandwidth()).attr('height', d => panelHeight - y(d[panel.key])).attr('fill', panel.color).attr('tabindex', 0).attr('role', 'button').attr('aria-label', d => `${d.quarter}: ${panel.format(d[panel.key])} ${panel.title}. Highlight this quarter.`);
      bars.append('title').text(d => `${d.quarter}\n${panel.title}: ${panel.format(d[panel.key])}`);
      bars.on('mouseenter focus', (_, d) => selectQuarter(d)).on('click', (_, d) => selectQuarter(d)).on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectQuarter(d); } });
      g.selectAll('.bar-label').data(data).join('text').attr('class', 'bar-label').attr('text-anchor', 'middle').attr('x', d => x(d.quarter) + x.bandwidth() / 2).attr('y', d => y(d[panel.key]) - 6).text(d => panel.format(d[panel.key]));
      if (index === 2) g.append('g').attr('class', 'axis').attr('transform', `translate(0,${panelHeight})`).call(d3.axisBottom(x).tickSize(0).tickPadding(10).tickFormat(d => compact ? d.replace('20', '') : d));
    });
  }

  function renderTrajectory() {
    trajectoryChart.selectAll('*').remove();
    const width = Math.max(300, trajectoryChart.node().clientWidth);
    const height = width < 600 ? 340 : 400;
    const m = { left: 52, right: 28, top: 23, bottom: 49 };
    const maxMiles = d3.max(data, d => d.miles_millions);
    const x = d3.scaleLinear().domain([0, maxMiles * 1.04]).nice().range([m.left, width - m.right]);
    const y = d3.scaleLinear().domain([0, Math.max(d3.max(data, d => d.crashes), d3.max(data, d => d.rate) * maxMiles) * 1.08]).nice().range([height - m.bottom, m.top]);
    const svg = trajectoryChart.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'Select a quarter to change the constant-rate reference line');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(''));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(width < 600 ? 5 : 8).tickSizeOuter(0));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
    svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left) / 2).attr('y', height - 7).attr('text-anchor', 'middle').text('Miles driven (millions)');
    svg.append('text').attr('class', 'axis-label').attr('transform', `translate(14,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Reported crashes');
    svg.append('line').attr('class', 'reference-line').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(maxMiles)).attr('y2', y(maxMiles * baseline.rate)).attr('stroke', '#8c929a').attr('stroke-width', 2).attr('stroke-dasharray', '2,5').append('title').text(`Constant ${baseline.quarter} rate: ${baseline.rate.toFixed(2)} crashes per million miles`);
    const line = d3.line().x(d => x(d.miles_millions)).y(d => y(d.crashes));
    svg.append('path').datum(data).attr('d', line).attr('fill', 'none').attr('stroke', colors.crashes).attr('stroke-width', 2);
    const points = svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(d.miles_millions)).attr('cy', d => y(d.crashes)).attr('r', 5).attr('fill', d => d.quarter === baseline.quarter ? colors.rate : colors.crashes).attr('tabindex', 0).attr('role', 'button').attr('aria-label', d => `${d.quarter}: ${fmtCount(d.crashes)} reported crashes over ${d.miles_millions.toFixed(2)} million miles. Use as reference quarter.`);
    points.append('title').text(d => `${d.quarter}\n${fmtCount(d.crashes)} crashes · ${d.miles_millions.toFixed(2)} million miles\n${d.rate.toFixed(2)} crashes per million miles\nSelect to use as reference`);
    points.on('mouseenter focus', (_, d) => selectQuarter(d)).on('click', (_, d) => setBaseline(d)).on('keydown', (event, d) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setBaseline(d); } });
    const compact = width < 600;
    const labelPositions = [];
    svg.selectAll('.point-label').data(data).join('text').attr('class', 'point-label').attr('text-anchor', 'middle').attr('x', d => x(d.miles_millions)).attr('y', d => {
      let labelY = y(d.crashes) - 13;
      while (labelPositions.some(p => Math.abs(p.x - x(d.miles_millions)) < (compact ? 45 : 60) && Math.abs(p.y - labelY) < 14)) labelY -= 15;
      labelPositions.push({ x: x(d.miles_millions), y: labelY });
      return labelY;
    }).text(d => compact ? d.quarter.replace('20', '') : d.quarter);
    d3.select('#baseline-summary').text(`Dotted reference: ${baseline.quarter} · ${baseline.rate.toFixed(2)} reported crashes per million miles, held constant as mileage grows.`);
  }

  d3.json('/static/data/waymo-quarterly.json').then(payload => {
    data = payload.quarters;
    if (!data || !data.length || data.some(d => !(d.miles > 0) || !Number.isFinite(d.rate))) throw new Error('Invalid chart data');
    baseline = data[0];
    d3.select('#baseline-quarter').selectAll('option').data(data).join('option').attr('value', d => d.quarter).text(d => d.quarter);
    d3.select('#baseline-quarter').on('change', event => setBaseline(data.find(d => d.quarter === event.target.value)));
    d3.select('#clear-selection').on('click', () => { selectQuarter(null); d3.select('#comparison-readout').text('Select or hover over a quarter to see its comparison.'); });
    function render() { renderQuarterly(); renderTrajectory(); selectQuarter(selected); }
    render();
    let previousWidth = quarterChart.node().clientWidth;
    new ResizeObserver(() => { const nextWidth = quarterChart.node().clientWidth; if (nextWidth !== previousWidth) { previousWidth = nextWidth; render(); } }).observe(quarterChart.node());
  }).catch(error => { console.error(error); d3.select('#load-error').property('hidden', false); });
})();

(() => {
  'use strict';
  const chart = d3.select('#trajectory-chart');

  d3.json('/static/data/waymo-quarterly.json').then(({ quarters: data }) => {
    const baseline = data.find(d => d.quarter === '2024 Q3');
    function render() {
      chart.selectAll('*').remove();
      const width = Math.max(300, chart.node().clientWidth);
      const compact = width < 600;
      const height = compact ? 400 : 550;
      const m = { left: 60, right: 30, top: 30, bottom: 52 };
      const maxMiles = d3.max(data, d => d.miles_millions);
      const x = d3.scaleLinear().domain([0, maxMiles * 1.04]).nice().range([m.left, width - m.right]);
      const y = d3.scaleLinear().domain([0, Math.max(d3.max(data, d => d.crashes), maxMiles * baseline.rate) * 1.08]).nice().range([height - m.bottom, m.top]);
      const svg = chart.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', 'Quarterly reported crashes against miles driven, with a reference line through the origin and 2024 Q3');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(compact ? 5 : 8).tickSizeOuter(0));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left) / 2).attr('y', height - 7).attr('text-anchor', 'middle').text('Miles driven (millions)');
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Reported crashes');
      svg.append('line').attr('class', 'reference-line').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(maxMiles)).attr('y2', y(maxMiles * baseline.rate)).attr('stroke', '#8c929a').attr('stroke-width', 2).attr('stroke-dasharray', '2,5');
      svg.append('path').datum(data).attr('d', d3.line().x(d => x(d.miles_millions)).y(d => y(d.crashes))).attr('fill', 'none').attr('stroke', '#426b9a').attr('stroke-width', 2);
      svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(d.miles_millions)).attr('cy', d => y(d.crashes)).attr('r', 5).attr('fill', '#426b9a');
      const labels = [];
      svg.selectAll('.point-label').data(data).join('text').attr('class', 'point-label').attr('text-anchor', 'middle').attr('x', d => x(d.miles_millions)).attr('y', d => {
        let labelY = y(d.crashes) - 13;
        while (labels.some(p => Math.abs(p.x - x(d.miles_millions)) < (compact ? 45 : 60) && Math.abs(p.y - labelY) < 14)) labelY -= 15;
        labels.push({ x: x(d.miles_millions), y: labelY });
        return labelY;
      }).text(d => compact ? d.quarter.replace('20', '') : d.quarter);
    }
    render();
    let previousWidth = chart.node().clientWidth;
    new ResizeObserver(() => {
      const nextWidth = chart.node().clientWidth;
      if (nextWidth !== previousWidth) { previousWidth = nextWidth; render(); }
    }).observe(chart.node());
  }).catch(console.error);
})();

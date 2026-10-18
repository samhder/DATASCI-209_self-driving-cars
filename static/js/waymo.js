(() => {
  'use strict';
  const trajectory = d3.select('#trajectory-chart');
  const rateChart = d3.select('#rate-chart');
  const blue = '#426b9a';
  const purple = '#7b6099';

  d3.json('/static/data/waymo-quarterly.json').then(({ quarters: data }) => {
    let baseline = data.find(d => d.quarter === '2024 Q3');
    let selected = null;
    let hovered = null;
    let updateReference;

    function updateHighlights() {
      const active = hovered || selected;
      d3.selectAll('.point')
        .attr('r', d => d.quarter === hovered ? 7 : 5)
        .attr('fill', d => d.quarter === active ? purple : blue)
        .attr('opacity', d => !active || d.quarter === active ? 1 : 0.4)
        .attr('stroke', d => d.quarter === selected ? '#252b33' : 'none')
        .attr('stroke-width', 2)
        .attr('aria-pressed', d => String(d.quarter === selected));
      d3.selectAll('.bar')
        .attr('fill', d => d.quarter === active ? purple : blue)
        .attr('opacity', d => !active || d.quarter === active ? 1 : 0.4)
        .attr('stroke', d => d.quarter === selected ? '#252b33' : 'none')
        .attr('stroke-width', 2)
        .attr('aria-pressed', d => String(d.quarter === selected));
    }

    function selectQuarter(d) {
      selected = d.quarter;
      baseline = d;
      updateReference();
      updateHighlights();
    }

    function bindInteractions(marks) {
      marks.attr('tabindex', 0).attr('role', 'button')
        .on('mouseenter focus', (_, d) => { hovered = d.quarter; updateHighlights(); })
        .on('mouseleave blur', () => { hovered = null; updateHighlights(); })
        .on('click', (_, d) => selectQuarter(d))
        .on('keydown', (event, d) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectQuarter(d);
          }
        });
    }

    function renderTrajectory(width, compact) {
      trajectory.selectAll('*').remove();
      const height = compact ? 400 : 550;
      const m = { left: 60, right: 30, top: 30, bottom: 52 };
      const maxMiles = d3.max(data, d => d.miles_millions);
      const x = d3.scaleLinear().domain([0, maxMiles * 1.04]).nice().range([m.left, width - m.right]);
      const y = d3.scaleLinear().domain([0, Math.max(d3.max(data, d => d.crashes), maxMiles * d3.max(data, d => d.rate)) * 1.08]).nice().range([height - m.bottom, m.top]);
      const svg = trajectory.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'Quarterly reported crashes against miles driven');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(compact ? 5 : 8).tickSizeOuter(0));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left) / 2).attr('y', height - 7).attr('text-anchor', 'middle').text('Miles driven (millions)');
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Reported crashes');
      const reference = svg.append('line').attr('class', 'reference-line').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(maxMiles)).attr('stroke', '#8c929a').attr('stroke-width', 2).attr('stroke-dasharray', '2,5');
      const referenceTitle = reference.append('title');
      updateReference = () => {
        reference.attr('y2', y(maxMiles * baseline.rate)).attr('aria-label', `Reference: ${baseline.quarter}, ${baseline.rate.toFixed(2)} reported crashes per million miles`);
        referenceTitle.text(`${baseline.quarter}: ${baseline.rate.toFixed(2)} reported crashes per million miles`);
      };
      updateReference();
      svg.append('path').datum(data).attr('d', d3.line().x(d => x(d.miles_millions)).y(d => y(d.crashes))).attr('fill', 'none').attr('stroke', blue).attr('stroke-width', 2);
      const points = svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(d.miles_millions)).attr('cy', d => y(d.crashes)).attr('r', 5).attr('aria-label', d => `${d.quarter}: ${d.crashes} reported crashes, ${d.miles_millions.toFixed(2)} million miles. Select reference quarter.`);
      points.append('title').text(d => `${d.quarter}: ${d.crashes} crashes, ${d.miles_millions.toFixed(2)} million miles, ${d.rate.toFixed(2)} crashes per million miles`);
      bindInteractions(points);
      const labels = [];
      svg.selectAll('.point-label').data(data).join('text').attr('class', 'point-label').attr('text-anchor', 'middle').attr('x', d => x(d.miles_millions)).attr('y', d => {
        let labelY = y(d.crashes) - 13;
        while (labels.some(p => Math.abs(p.x - x(d.miles_millions)) < (compact ? 45 : 60) && Math.abs(p.y - labelY) < 14)) labelY -= 15;
        labels.push({ x: x(d.miles_millions), y: labelY });
        return labelY;
      }).text(d => compact ? d.quarter.replace('20', '') : d.quarter);
    }

    function renderRates(width, compact) {
      rateChart.selectAll('*').remove();
      const height = 270;
      const m = { left: 60, right: 30, top: 24, bottom: 40 };
      const x = d3.scaleBand().domain(data.map(d => d.quarter)).range([m.left, width - m.right]).padding(0.35);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => d.rate) * 1.12]).nice(4).range([height - m.bottom, m.top]);
      const svg = rateChart.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'Quarterly reported crashes per million miles');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).tickSize(0).tickPadding(10).tickFormat(d => compact ? d.replace('20', '') : d));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Reported crashes / million miles');
      const bars = svg.selectAll('.bar').data(data).join('rect').attr('class', 'bar').attr('x', d => x(d.quarter)).attr('y', d => y(d.rate)).attr('width', x.bandwidth()).attr('height', d => height - m.bottom - y(d.rate)).attr('aria-label', d => `${d.quarter}: ${d.rate.toFixed(2)} reported crashes per million miles. Select reference quarter.`);
      bars.append('title').text(d => `${d.quarter}: ${d.rate.toFixed(2)} reported crashes per million miles`);
      bindInteractions(bars);
      svg.selectAll('.bar-label').data(data).join('text').attr('class', 'bar-label').attr('text-anchor', 'middle').attr('x', d => x(d.quarter) + x.bandwidth() / 2).attr('y', d => y(d.rate) - 6).text(d => d.rate.toFixed(2));
    }

    function render() {
      hovered = null;
      const width = Math.max(300, trajectory.node().clientWidth);
      renderTrajectory(width, width < 600);
      renderRates(width, width < 600);
      updateHighlights();
    }
    render();
    let previousWidth = trajectory.node().clientWidth;
    new ResizeObserver(() => {
      const nextWidth = trajectory.node().clientWidth;
      if (nextWidth !== previousWidth) { previousWidth = nextWidth; render(); }
    }).observe(trajectory.node());
  }).catch(console.error);
})();

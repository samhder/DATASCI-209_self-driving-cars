(() => {
  'use strict';
  const trajectory = d3.select('#trajectory-chart');
  const comparison = d3.select('#comparison-chart');
  const waymoColor = '#b66a35';
  const humanColor = '#426b9a';

  Promise.all([d3.json('/static/data/waymo-quarterly.json'), d3.json('/static/data/human-annual.json')]).then(([{ quarters: data }, { annual: human }]) => {
    const human2024 = human.find(d => d.year === 2024);
    let humanHovered = false;
    let baseline = data.find(d => d.quarter === '2024 Q3');
    let selected = null;
    let hovered = null;
    let updateReference;

    function updateHighlights() {
      const active = hovered || selected;
      d3.select('.waymo-page').selectAll('.point')
        .attr('r', d => d.quarter === hovered ? 7 : 5)
        .attr('fill', waymoColor)
        .attr('opacity', d => !active || d.quarter === hovered || d.quarter === selected ? 1 : 0.4)
        .attr('stroke', 'none')
        .attr('aria-pressed', d => String(d.quarter === selected));
      comparison.selectAll('.human-point').attr('r', d => d.year === 2024 && humanHovered ? 7 : 5);
      trajectory.selectAll('.human-reference-line').attr('stroke-width', humanHovered ? 3.5 : 2);
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

    function renderComparison(width, compact) {
      comparison.selectAll('*').remove();
      const height = 320;
      const m = { left: 60, right: 30, top: 34, bottom: 48 };
      const quarterYear = d => {
        const [year, quarter] = d.quarter.split(' Q').map(Number);
        return year + (quarter - 0.5) / 4;
      };
      const firstYear = human[0].year;
      const lastYear = Math.ceil(d3.max(data, quarterYear) * 4) / 4;
      const earlierSpan = (2024 - firstYear) / 2;
      const breakX = m.left + (width - m.left - m.right) * earlierSpan / (earlierSpan + lastYear - 2024);
      const x = d3.scaleLinear().domain([firstYear, 2024, lastYear]).range([m.left, breakX, width - m.right]);
      const y = d3.scaleLinear().domain([0, d3.max([...human, ...data], d => d.rate) * 1.12]).nice(4).range([height - m.bottom, m.top]);
      const svg = comparison.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'U.S. annual and Waymo quarterly police-reported crash involvements per million miles');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).tickValues(d3.range(firstYear, Math.floor(lastYear) + 1).filter(year => !compact || year >= 2024 || (year - firstYear) % 4 === 0)).tickFormat(d3.format('d')).tickSizeOuter(0));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Crash involvements / million miles');
      svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left - m.right) / 2).attr('y', height - 6).attr('text-anchor', 'middle').text('Year');
      const legend = svg.append('g').attr('transform', `translate(${width - m.right - (compact ? 230 : 305)},14)`);
      [{ name: compact ? 'U.S. (annual)' : 'U.S. driving (annual)', color: humanColor, offset: 0 }, { name: 'Waymo (quarterly)', color: waymoColor, offset: compact ? 108 : 170 }].forEach(d => {
        legend.append('line').attr('x1', d.offset).attr('x2', d.offset + 18).attr('stroke', d.color).attr('stroke-width', 2);
        legend.append('text').attr('class', 'series-label').attr('x', d.offset + 24).attr('y', 4).text(d.name);
      });
      svg.append('path').datum(human).attr('class', 'human-line').attr('d', d3.line().x(d => x(d.year + 0.5)).y(d => y(d.rate))).attr('fill', 'none').attr('stroke', humanColor).attr('stroke-width', 2);
      const humanPoints = svg.selectAll('.human-point').data(human).join('circle').attr('class', d => `human-point${d.year === 2024 ? ' human-benchmark' : ''}`).attr('cx', d => x(d.year + 0.5)).attr('cy', d => y(d.rate)).attr('r', 5).attr('fill', humanColor);
      humanPoints.append('title').text(d => `U.S. ${d.year}: ${d.rate.toFixed(2)} estimated crash involvements per million miles`);
      humanPoints.filter(d => d.year === 2024).attr('tabindex', 0).attr('role', 'img').attr('aria-label', `U.S. 2024: ${human2024.rate.toFixed(2)} crash involvements per million miles; reference line in the lower chart`).on('mouseenter focus', () => { humanHovered = true; updateHighlights(); }).on('mouseleave blur', () => { humanHovered = false; updateHighlights(); });
      svg.selectAll('.human-label').data(human.filter((d, i) => !compact || i % 2 === 0)).join('text').attr('class', 'point-label human-label').attr('text-anchor', 'middle').attr('x', d => x(d.year + 0.5)).attr('y', d => y(d.rate) - 12).text(d => d.rate.toFixed(2));
      svg.append('path').datum(data).attr('class', 'waymo-rate-line').attr('d', d3.line().x(d => x(quarterYear(d))).y(d => y(d.rate))).attr('fill', 'none').attr('stroke', waymoColor).attr('stroke-width', 2);
      const points = svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(quarterYear(d))).attr('cy', d => y(d.rate)).attr('r', 5).attr('aria-label', d => `${d.quarter}: ${d.rate.toFixed(2)} Waymo crash involvements per million miles. Select reference quarter.`);
      points.append('title').text(d => `Waymo ${d.quarter}: ${d.rate.toFixed(2)} crash involvements per million miles`);
      bindInteractions(points);
      const labels = [];
      svg.selectAll('.waymo-rate-label').data(data).join('text').attr('class', 'point-label waymo-rate-label').attr('text-anchor', 'middle').attr('x', d => x(quarterYear(d))).attr('y', d => {
        let labelY = y(d.rate) - 13;
        while (labels.some(p => Math.abs(p.x - x(quarterYear(d))) < 38 && Math.abs(p.y - labelY) < 14)) labelY -= 15;
        labels.push({ x: x(quarterYear(d)), y: labelY });
        return labelY;
      }).text(d => d.rate.toFixed(2));
    }

    function renderTrajectory(width, compact) {
      trajectory.selectAll('*').remove();
      const height = compact ? 400 : 550;
      const m = { left: 60, right: 30, top: 30, bottom: 52 };
      const x = d3.scaleLinear().domain([0, d3.max(data, d => d.miles_millions) * 1.04]).nice().range([m.left, width - m.right]);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => d.crashes) * 1.12]).nice().range([height - m.bottom, m.top]);
      const svg = trajectory.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'Quarterly police-reported crash involvements against miles driven');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(compact ? 5 : 8).tickSizeOuter(0));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left) / 2).attr('y', height - 7).attr('text-anchor', 'middle').text('Miles driven (millions)');
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Crash involvements');
      const reference = svg.append('line').attr('class', 'reference-line').attr('stroke', '#8c929a').attr('stroke-width', 2).attr('stroke-dasharray', '2,5');
      const referenceTitle = reference.append('title');
      function setLine(line, rate) {
        const endMiles = Math.min(x.domain()[1], y.domain()[1] / rate);
        line.attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(endMiles)).attr('y2', y(endMiles * rate));
      }
      updateReference = () => {
        setLine(reference, baseline.rate);
        reference.attr('aria-label', `Reference: ${baseline.quarter}, ${baseline.rate.toFixed(2)} police-reported crash involvements per million miles`);
        referenceTitle.text(`${baseline.quarter}: ${baseline.rate.toFixed(2)} police-reported crash involvements per million miles`);
      };
      updateReference();
      const humanReference = svg.append('line').attr('class', 'human-reference-line').attr('stroke', humanColor).attr('stroke-width', 2).attr('stroke-dasharray', '7,4').attr('pointer-events', 'none');
      setLine(humanReference, human2024.rate);
      const labelX = +humanReference.attr('x2') + 46;
      svg.append('defs').append('marker').attr('id', 'human-offplot-arrowhead').attr('viewBox', '0 0 7 7').attr('refX', 6).attr('refY', 3.5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto').append('path').attr('d', 'M0,0 L7,3.5 L0,7 Z').attr('fill', humanColor);
      svg.append('line').attr('class', 'human-offplot-arrow').attr('x1', labelX - 6).attr('y1', m.top - 15).attr('x2', labelX + 6).attr('y2', m.top - 27).attr('stroke', humanColor).attr('stroke-width', 1.5).attr('marker-end', 'url(#human-offplot-arrowhead)').attr('pointer-events', 'none');
      const referenceLabel = svg.append('text').attr('class', 'human-reference-label human-benchmark').attr('x', labelX).attr('y', m.top - 2).attr('text-anchor', 'middle').attr('fill', humanColor).attr('tabindex', 0).attr('role', 'img').attr('aria-label', `U.S. 2024 reference: ${human2024.rate.toFixed(2)} crash involvements per million miles. Hover or focus to highlight U.S. 2024 in the top chart.`).text('U.S. 2024');
      referenceLabel.append('title').text(`U.S. 2024: ${human2024.rate.toFixed(2)} crash involvements per million miles`);
      referenceLabel.on('mouseenter focus', () => { humanHovered = true; updateHighlights(); })
        .on('mouseleave blur', () => { humanHovered = false; updateHighlights(); });
      svg.append('path').datum(data).attr('d', d3.line().x(d => x(d.miles_millions)).y(d => y(d.crashes))).attr('fill', 'none').attr('stroke', waymoColor).attr('stroke-width', 2);
      const points = svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(d.miles_millions)).attr('cy', d => y(d.crashes)).attr('r', 5).attr('aria-label', d => `${d.quarter}: ${d.crashes} police-reported crash involvements, ${d.miles_millions.toFixed(2)} million miles. Select reference quarter.`);
      points.append('title').text(d => `${d.quarter}: ${d.crashes} crashes, ${d.miles_millions.toFixed(2)} million miles, ${d.rate.toFixed(2)} crashes per million miles`);
      bindInteractions(points);
      const placed = [];
      svg.selectAll('.quarter-label').data(data).join('text').attr('class', 'point-label quarter-label').attr('text-anchor', 'middle').attr('x', d => x(d.miles_millions)).attr('y', d => {
        let labelY = y(d.crashes) - 13;
        while (placed.some(p => Math.abs(p.x - x(d.miles_millions)) < (compact ? 45 : 60) && Math.abs(p.y - labelY) < 14)) labelY -= 15;
        placed.push({ x: x(d.miles_millions), y: labelY });
        return labelY;
      }).text(d => compact ? d.quarter.replace('20', '') : d.quarter);
    }

    function render(width) {
      hovered = null;
      humanHovered = false;
      renderComparison(width, width < 600);
      renderTrajectory(width, width < 600);
      updateHighlights();
    }
    let previousWidth;
    new ResizeObserver(([entry]) => {
      const width = Math.max(300, Math.floor(entry.contentRect.width));
      if (width === previousWidth) return;
      previousWidth = width;
      render(width);
    }).observe(trajectory.node());
  }).catch(console.error);
})();

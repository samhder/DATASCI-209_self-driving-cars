(() => {
  'use strict';
  const trajectory = d3.select('#trajectory-chart');
  const comparison = d3.select('#comparison-chart');
  const waymoColor = '#b66a35';
  const humanColor = '#426b9a';

  Promise.all([
    d3.json('/static/data/waymo-quarterly.json'),
    d3.json('/static/data/human-annual.json'),
    d3.json('/static/data/crash-outcomes.json')
  ]).then(([waymoData, humanData, { outcomes, locations, driver_benchmarks: driverBenchmarks }]) => {
    const datasets = { all: { quarters: waymoData.quarters, annual: humanData.annual }, ...outcomes };
    const outcomeNames = { all: 'Crash involvements', injury: 'Injury-crash involvements', fatal: 'Fatal-crash involvements' };
    const pageTitles = { all: 'Crashes', injury: 'Injury Crashes', fatal: 'Fatal Crashes' };
    let outcome = 'all';
    const selectedLocations = new Set();
    let data = datasets.all.quarters;
    let human = datasets.all.annual;
    let human2024 = human.find(d => d.year === 2024);
    let regionalBenchmark = null;
    let hoveredHumanYear = null;
    let updateBenchmark = () => {};
    const defaultQuarter = data[data.length - 1].quarter;
    let selected = null;
    let hovered = null;
    let focused = null;
    let humanHovered = false;
    const readout = d3.select('#quarter-readout');
    const tooltip = d3.select('#waymo-tooltip');
    const formatCount = d3.format(',');
    const formatRate = rate => rate.toFixed(outcome === 'fatal' ? 3 : 2);
    const humanCount = d => d.estimated_crash_involvements ?? d.crash_involvements;
    const countDescription = () => outcome === 'fatal' ? 'crash involvements' : 'estimated crash involvements';
    const quarterYear = d => {
      const [year, quarter] = d.quarter.split(' Q').map(Number);
      return year + (quarter - 1) / 4;
    };

    function fitLine(rows, getYear) {
      const center = d3.mean(rows, getYear);
      const meanRate = d3.mean(rows, d => d.rate);
      const slope = d3.sum(rows, d => (getYear(d) - center) * (d.rate - meanRate))
        / d3.sum(rows, d => (getYear(d) - center) ** 2);
      return year => meanRate + slope * (year - center);
    }

    let humanFit = fitLine(human, d => d.year);
    let waymoFit = fitLine(data, quarterYear);

    function quarterDetails(d) {
      const difference = (1 - d.rate / humanFit(quarterYear(d))) * 100;
      const direction = difference >= 0 ? 'safer' : 'less safe';
      return [
        [outcomeNames[outcome], formatCount(d.crashes)],
        ['Miles driven', d.miles_millions.toFixed(2) + ' million'],
        ['Per million miles', formatRate(d.rate)],
        ['Versus Overall', Math.abs(difference).toFixed(0) + '% ' + direction]
      ];
    }

    const areaLabel = () => [...selectedLocations].map(key => locations[key].label).join(' + ');
    const driverReference = () => regionalBenchmark || human.find(d => d.year === hoveredHumanYear) || human2024;
    const driverHeading = d => 'All drivers · ' + (regionalBenchmark ? 'Published benchmark' : d.year);
    const driverValues = d => regionalBenchmark ? [
      ['Per million miles', formatRate(d.rate)]
    ] : [
      [outcomeNames[outcome], formatCount(Math.round(humanCount(d)))],
      ['Miles driven', (d.miles_millions / 1e6).toFixed(2) + ' trillion'],
      ['Per million miles', formatRate(d.rate)]
    ];

    function showDriver(event, d) {
      showTooltip(event, driverHeading(d), [
        regionalBenchmark ? areaLabel() : 'Nationwide',
        ...driverValues(d).map(([label, value]) => label + ' · ' + value)
      ]);
    }

    function bindDriverInteractions(marks) {
      marks.attr('tabindex', 0).attr('role', 'img')
        .on('pointerdown', event => event.preventDefault())
        .on('pointerenter focus', (event, d) => {
          hoveredHumanYear = d.year ?? null;
          humanHovered = true;
          updateHighlights();
          showDriver(event, d);
        })
        .on('pointermove', moveTooltip)
        .on('pointerleave blur', () => {
          hoveredHumanYear = null;
          humanHovered = false;
          tooltip.attr('hidden', true);
          updateHighlights();
        });
    }

    function updateReadout() {
      const active = data.find(d => d.quarter === (hovered || focused || selected || defaultQuarter));
      const driver = humanHovered ? driverReference() : null;
      readout.select('.readout-quarter').text(driver ? driverHeading(driver) : 'Waymo ' + active.quarter);
      const areaText = selectedLocations.size ? areaLabel() : driver ? 'Nationwide' : 'All locations';
      const outcomeText = { all: 'All police-reported crashes', injury: 'Injury crashes', fatal: 'Fatal crashes' }[outcome];
      readout.select('.readout-context').text(areaText + ' · ' + outcomeText);
      const values = driver ? driverValues(driver) : quarterDetails(active);
      readout.select('dl').selectAll('div.metric').data(values).join(
        enter => {
          const metric = enter.append('div').attr('class', 'metric');
          metric.append('dt');
          metric.append('dd');
          return metric;
        }
      ).call(metrics => {
        metrics.select('dt').text(d => d[0]);
        metrics.select('dd').text(d => d[1]);
      });

    }

    function updateHighlights() {
      const active = hovered || focused || selected;
      d3.select('.waymo-page').selectAll('.point')
        .attr('r', d => d.quarter === hovered ? 7 : 5)
        .attr('fill', waymoColor)
        .attr('opacity', d => !active || d.quarter === active ? 1 : 0.4)
        .attr('stroke', 'none')
        .attr('aria-pressed', d => String(d.quarter === selected));
      comparison.selectAll('.human-point')
        .attr('r', d => d.year === (hoveredHumanYear ?? 2024) && humanHovered ? 7 : 5);
      trajectory.select('.human-reference-line').attr('stroke-width', humanHovered ? 3.5 : 2);
      updateBenchmark();
      updateReadout();
    }

    function moveTooltip(event) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX || bounds.x + bounds.width / 2;
      const pointerY = event.clientY || bounds.y + bounds.height / 2;
      const box = tooltip.node().getBoundingClientRect();
      tooltip.style('left', Math.max(8, Math.min(pointerX + 16, window.innerWidth - box.width - 8)) + 'px')
        .style('top', Math.max(8, Math.min(pointerY + 16, window.innerHeight - box.height - 8)) + 'px');
    }

    function showTooltip(event, heading, lines) {
      tooltip.select('strong').text(heading);
      tooltip.selectAll('div').data(lines).join('div').text(d => d);
      tooltip.attr('hidden', null);
      moveTooltip(event);
    }

    function showQuarter(event, d) {
      showTooltip(event, 'Waymo ' + d.quarter,
        quarterDetails(d).map(([label, value]) => label + ' · ' + value));
    }

    function selectQuarter(d) {
      selected = selected === d.quarter ? null : d.quarter;
      updateHighlights();
    }

    function bindInteractions(marks) {
      marks.attr('tabindex', 0).attr('role', 'button')
        .on('pointerdown', event => event.preventDefault())
        .on('pointerenter', (event, d) => {
          hovered = d.quarter;
          updateHighlights();
          showQuarter(event, d);
        })
        .on('pointermove', moveTooltip)
        .on('pointerleave', () => {
          hovered = null;
          tooltip.attr('hidden', true);
          updateHighlights();
        })
        .on('focus', (event, d) => {
          focused = d.quarter;
          updateHighlights();
          showQuarter(event, d);
        })
        .on('blur', () => {
          focused = null;
          tooltip.attr('hidden', true);
          updateHighlights();
        })
        .on('click', (_, d) => selectQuarter(d))
        .on('keydown', (event, d) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectQuarter(d);
          }
          if (event.key === 'Escape') {
            selected = null;
            tooltip.attr('hidden', true);
            event.currentTarget.blur();
            updateHighlights();
          }
        });
    }

    function renderComparison(width, compact) {
      comparison.selectAll('*').remove();
      const height = 320;
      const m = { left: 60, right: 30, top: 34, bottom: 48 };
      const firstYear = regionalBenchmark ? Math.floor(quarterYear(data[0])) : human[0].year;
      const lastYear = Math.ceil(d3.max(data, quarterYear) * 4) / 4 + 0.25;
      const earlierSpan = (2024 - firstYear) / 2;
      const breakX = m.left + (width - m.left - m.right) * earlierSpan / (earlierSpan + lastYear - 2024);
      const x = d3.scaleLinear().domain([firstYear - 0.35, 2024, lastYear]).range([m.left, breakX, width - m.right]);
      const y = d3.scaleLinear().domain([0, d3.max([...(regionalBenchmark ? [regionalBenchmark] : human), ...data], d => d.rate) * 1.12]).nice(4).range([height - m.bottom, m.top]);
      const svg = comparison.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'All drivers and Waymo police-reported crash involvements per million miles');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).tickValues(d3.range(firstYear, Math.floor(lastYear) + 1).filter(year => !compact || year >= 2024 || (year - firstYear) % 4 === 0)).tickFormat(d3.format('d')).tickSizeOuter(0));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Crash involvements per million miles');
      svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left - m.right) / 2).attr('y', height - 6).attr('text-anchor', 'middle').text('Year');
      const legend = svg.append('g').attr('transform', `translate(${width - m.right - (compact ? 225 : 270)},14)`);
      [{ name: 'All drivers', color: humanColor, offset: 0 }, { name: 'Waymo', color: waymoColor, offset: compact ? 145 : 180 }].forEach(d => {
        legend.append('line').attr('x1', d.offset).attr('x2', d.offset + 18).attr('stroke', d.color).attr('stroke-width', 2);
        legend.append('text').attr('class', 'series-label').attr('x', d.offset + 24).attr('y', 4).text(d.name);
      });
      function drawFit(start, end, fit, color, dash, className) {
        const years = d3.range(start, end, 0.05).concat(end);
        const seriesName = className === 'human-fit' ? 'All drivers' : 'Waymo';
        const mainLine = className === 'human-fit' ? '.human-line' : '.waymo-rate-line';
        const path = d3.line().x(year => x(year)).y(year => y(fit(year)))(years);
        const regression = svg.append('g').attr('class', 'regression')
          .attr('tabindex', 0).attr('role', 'img')
          .attr('aria-label', seriesName + ' linear regression')
          .on('pointerdown', event => event.preventDefault())
          .on('pointerenter focusin', () => {
            svg.select(mainLine).attr('opacity', 0.15);
            regression.select('.' + className).attr('opacity', 1);
          })
          .on('pointerleave focusout', () => {
            svg.select(mainLine).attr('opacity', 1);
            regression.select('.' + className).attr('opacity', 0.65);
          });
        regression.append('path').attr('class', 'regression-target').attr('d', path)
          .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 14);
        regression.append('path').attr('class', className).attr('d', path)
          .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2)
          .attr('stroke-dasharray', dash).attr('opacity', 0.65)
          .attr('pointer-events', 'none');
      }
      if (!regionalBenchmark) drawFit(firstYear, lastYear, humanFit, humanColor, '6,4', 'human-fit');
      drawFit(quarterYear(data[0]) - 0.25, quarterYear(data[data.length - 1]) + 0.25,
        waymoFit, waymoColor, '6,4', 'waymo-fit');
      if (regionalBenchmark) {
        const reference = svg.append('g').datum(regionalBenchmark).attr('class', 'regional-benchmark');
        reference.append('line').attr('class', 'human-reference-target')
          .attr('x1', x(firstYear)).attr('x2', x(lastYear))
          .attr('y1', y(regionalBenchmark.rate)).attr('y2', y(regionalBenchmark.rate))
          .attr('stroke', 'transparent').attr('stroke-width', 14);
        reference.append('line').attr('class', 'human-line')
          .attr('x1', x(firstYear)).attr('x2', x(lastYear))
          .attr('y1', y(regionalBenchmark.rate)).attr('y2', y(regionalBenchmark.rate))
          .attr('stroke', humanColor).attr('stroke-width', 2).attr('stroke-dasharray', '6,4');
        reference.append('text').attr('class', 'point-label human-label')
          .attr('x', x(firstYear) + 8).attr('y', y(regionalBenchmark.rate) - 12)
          .text(formatRate(regionalBenchmark.rate));
        reference.attr('aria-label', 'All drivers published regional benchmark: '
          + formatRate(regionalBenchmark.rate) + ' crash involvements per million miles');
        bindDriverInteractions(reference);
      } else {
        svg.append('path').datum(human).attr('class', 'human-line').attr('d', d3.line().x(d => x(d.year)).y(d => y(d.rate))).attr('fill', 'none').attr('stroke', humanColor).attr('stroke-width', 2);
        const humanPoints = svg.selectAll('.human-point').data(human).join('circle').attr('class', d => `human-point${d.year === 2024 ? ' human-benchmark' : ''}`).attr('cx', d => x(d.year)).attr('cy', d => y(d.rate)).attr('r', 5).attr('fill', humanColor)
          .attr('aria-label', d => 'All drivers ' + d.year + ': ' + formatRate(d.rate)
            + ' crash involvements per million miles');
        bindDriverInteractions(humanPoints);
        svg.selectAll('.human-label').data(human.filter((d, i) => !compact || i % 2 === 0)).join('text').attr('class', 'point-label human-label').attr('text-anchor', 'middle').attr('x', d => x(d.year)).attr('y', d => y(d.rate) - 12).text(d => formatRate(d.rate));
      }
      svg.append('path').datum(data).attr('class', 'waymo-rate-line').attr('d', d3.line().x(d => x(quarterYear(d))).y(d => y(d.rate))).attr('fill', 'none').attr('stroke', waymoColor).attr('stroke-width', 2);
      const points = svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(quarterYear(d))).attr('cy', d => y(d.rate)).attr('r', 5).attr('aria-label', d => `${d.quarter}: ${formatRate(d.rate)} Waymo crash involvements per million miles.`);

      bindInteractions(points);
      const labels = [];
      svg.selectAll('.waymo-rate-label').data(data.filter((d, i) => !compact || i === 0 || i === data.length - 1)).join('text').attr('class', 'point-label waymo-rate-label').attr('text-anchor', 'middle').attr('x', d => x(quarterYear(d))).attr('y', d => {
        let labelY = y(d.rate) - 13;
        while (labels.some(p => Math.abs(p.x - x(quarterYear(d))) < 38 && Math.abs(p.y - labelY) < 14)) labelY -= 15;
        labels.push({ x: x(quarterYear(d)), y: labelY });
        return labelY;
      }).text(d => formatRate(d.rate));
    }

    function renderTrajectory(width, compact) {
      trajectory.selectAll('*').remove();
      const height = compact ? 400 : 550;
      const m = { left: 60, right: 30, top: 30, bottom: 52 };
      const x = d3.scaleLinear().domain([0, d3.max(data, d => d.miles_millions) * 1.04]).nice().range([m.left, width - m.right]);
      const y = d3.scaleLinear().domain([0, Math.max(1, Math.ceil(d3.max(data, d => d.crashes) * 1.12))]).nice().range([height - m.bottom, m.top]);
      const svg = trajectory.append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', 'Quarterly police-reported crash involvements against miles driven');
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(Math.min(5, y.domain()[1])).tickSize(-(width - m.left - m.right)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - m.bottom})`).call(d3.axisBottom(x).ticks(compact ? 5 : 8).tickSizeOuter(0));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(Math.min(5, y.domain()[1])).tickSize(0).tickPadding(8)).call(g => g.select('.domain').remove());
      svg.append('text').attr('class', 'axis-label').attr('x', (width + m.left) / 2).attr('y', height - 7).attr('text-anchor', 'middle').text('Quarterly miles driven (millions)');
      svg.append('text').attr('class', 'axis-label').attr('transform', `translate(16,${(height - m.bottom + m.top) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Quarterly ' + outcomeNames[outcome].toLowerCase());
      const reference = driverReference;
      svg.append('defs').append('marker')
        .attr('id', 'us-rate-arrow').attr('viewBox', '0 0 8 8')
        .attr('refX', 7).attr('refY', 4)
        .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
        .append('path').attr('d', 'M0,0 L8,4 L0,8 Z').attr('fill', humanColor);
      const benchmark = svg.append('g').attr('class', 'human-benchmark')
        .attr('tabindex', 0).attr('role', 'img')
        .on('pointerdown', event => event.preventDefault())
        .on('pointerenter focus', event => {
          humanHovered = true;
          updateHighlights();
          const d = reference();
          showDriver(event, d);
        })
        .on('pointermove', moveTooltip)
        .on('pointerleave blur', () => {
          humanHovered = false;
          tooltip.attr('hidden', true);
          updateHighlights();
        });
      benchmark.append('line').attr('class', 'human-reference-target')
        .attr('stroke', 'transparent').attr('stroke-width', 14);
      benchmark.append('line').attr('class', 'human-reference-line')
        .attr('stroke', humanColor).attr('stroke-width', 2)
        .attr('stroke-dasharray', '7,4').attr('marker-end', 'url(#us-rate-arrow)')
        .attr('pointer-events', 'none');
      benchmark.append('text').attr('class', 'human-reference-label')
        .attr('text-anchor', 'middle').attr('fill', humanColor);
      updateBenchmark = () => {
        const d = reference();
        const endMiles = Math.min(x.domain()[1], y.domain()[1] / d.rate);
        const endY = y(endMiles * d.rate);
        benchmark.attr('aria-label', driverHeading(d) + ': '
          + formatRate(d.rate) + ' crash involvements per million miles');
        benchmark.selectAll('line')
          .attr('x1', x(0)).attr('y1', y(0))
          .attr('x2', x(endMiles)).attr('y2', endY);
        benchmark.select('text')
          .attr('x', Math.min(x(endMiles) + 50, width - m.right - 65))
          .attr('y', Math.max(m.top - 12, endY - 12))
          .text(regionalBenchmark ? 'All drivers (benchmark)' : 'All drivers (' + d.year + ')');
      };
      svg.append('path').datum(data).attr('d', d3.line().x(d => x(d.miles_millions)).y(d => y(d.crashes))).attr('fill', 'none').attr('stroke', waymoColor).attr('stroke-width', 2);
      const points = svg.selectAll('.point').data(data).join('circle').attr('class', 'point').attr('cx', d => x(d.miles_millions)).attr('cy', d => y(d.crashes)).attr('r', 5).attr('aria-label', d => `${d.quarter}: ${d.crashes} police-reported crash involvements, ${d.miles_millions.toFixed(2)} million miles.`);

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
      focused = null;
      humanHovered = false;
      hoveredHumanYear = null;
      tooltip.attr('hidden', true);
      renderComparison(width, width < 600);
      renderTrajectory(width, width < 600);
      updateHighlights();
    }
    function applyFilters() {
      d3.selectAll('[data-outcome]').attr('aria-pressed', function () {
        return String(this.dataset.outcome === outcome);
      });
      d3.selectAll('[data-location]').attr('aria-pressed', function () {
        return String(this.dataset.location === 'all' ? selectedLocations.size === 0 : selectedLocations.has(this.dataset.location));
      });
      human = datasets[outcome].annual;
      human2024 = human.find(d => d.year === 2024);
      data = datasets[outcome].quarters;
      const selectedAreas = [...selectedLocations].map(key => locations[key]);
      if (selectedAreas.length) {
        const countKey = { all: 'crashes', injury: 'injury_crashes', fatal: 'fatal_crashes' }[outcome];
        data = selectedAreas[0].quarters.map(quarter => {
          const rows = selectedAreas.map(area => area.quarters.find(d => d.quarter === quarter.quarter));
          const crashes = d3.sum(rows, d => d[countKey]);
          const miles = d3.sum(rows, d => d.miles);
          return {
            quarter: quarter.quarter, crashes, miles,
            miles_millions: miles / 1e6, rate: crashes / miles * 1e6
          };
        });
      }
      if (!data.some(d => d.quarter === selected)) selected = null;
      regionalBenchmark = null;
      if (selectedLocations.size) {
        const totalMiles = d3.sum(data, d => d.miles);
        const expectedCrashes = d3.sum([...selectedLocations], key =>
          driverBenchmarks[key][outcome].rate * d3.sum(locations[key].quarters, d => d.miles) / 1e6);
        regionalBenchmark = { rate: expectedCrashes / (totalMiles / 1e6) };
      }
      humanFit = regionalBenchmark ? () => regionalBenchmark.rate : fitLine(human, d => d.year);
      waymoFit = fitLine(data, quarterYear);
      d3.select('.waymo-page h1').text(pageTitles[outcome] + ' per Million Miles Driven');
      d3.select('#location-coverage').text(selectedLocations.size
        ? 'Available quarters · ' + data[0].quarter + '–' + data[data.length - 1].quarter
        : '');
      d3.select('#waymo-source-note').text(!selectedLocations.size
        ? 'Waymo uses police-reported vehicle involvements and rider-only miles.'
        : 'Location histories use the earlier named service areas and their matching counties.');
      d3.select('#driver-reference-note').text(regionalBenchmark
        ? 'All drivers uses a fixed, published county benchmark. Combined locations are weighted by Waymo miles over the displayed quarters.'
        : 'All drivers covers nationwide motor-vehicle traffic. The rate arrow defaults to 2024 and follows hovered years.');
      d3.select('#us-source-note').text(regionalBenchmark
        ? 'Regional rates use Waymo CSV3 non-dynamic benchmarks; injury uses the observed rate without an underreporting correction. These are reference levels, not annual trends.'
        : outcome === 'fatal'
        ? 'U.S. fatal-crash involvements use FARS vehicle records and FHWA mileage. This counts vehicles in crashes involving a fatality.'
        : 'U.S. rates use CRSS vehicle-weighted estimates and FHWA mileage. Injury crashes include reported injuries of any severity, including fatal injury.');
      render(previousWidth);
    }

    d3.selectAll('[data-outcome]').on('click', event => {
      outcome = event.currentTarget.dataset.outcome;
      applyFilters();
    });
    d3.selectAll('[data-location]').on('click', event => {
      const key = event.currentTarget.dataset.location;
      if (key === 'all') selectedLocations.clear();
      else if (selectedLocations.has(key)) selectedLocations.delete(key);
      else selectedLocations.add(key);
      applyFilters();
    });
    let previousWidth;
    new ResizeObserver(([entry]) => {
      const width = Math.max(300, Math.floor(entry.contentRect.width));
      if (width === previousWidth) return;
      previousWidth = width;
      applyFilters();
    }).observe(trajectory.node());
  }).catch(error => {
    console.error(error);
    d3.select('#quarter-readout').text('Chart data could not load. Please reload the page.');
  });
})();

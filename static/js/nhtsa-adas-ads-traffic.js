const _1 = (md) => {
  return md`
# 209 Final Project
  `;
};

const _7 = function chart(d3, traffic, incidents) {
  // =========================================================
  // 1. CONFIGURATION
  // =========================================================

  // ---------------------------------------------------------
  // 1.1 Chart dimensions
  // ---------------------------------------------------------

  const width = 900;
  const height = 600;
  const headerHeight = 120;

  const margin = {
    top: headerHeight + 55,
    right: 35,
    bottom: 65,
    left: 75,
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // ---------------------------------------------------------
  // 1.2 Colors and animation
  // ---------------------------------------------------------

  const colors = {
    incidents: "var(--rain)",
    traffic: "var(--clear)",
    grid: "var(--grid)",
    header: "var(--card)",
    border: "var(--line)",
    secondaryText: "var(--text2)",
  };

  const transitionDuration = 650;
  const transitionEase = d3.easeCubicInOut;

  // =========================================================
  // 2. FILTER CONFIGURATION
  // =========================================================

  // ---------------------------------------------------------
  // 2.1 Available quarters
  // ---------------------------------------------------------

  const availableDates = [
    ...new Set(
      traffic.map((d) => {
        const quarter = Math.ceil(d.month / 3);
        return `${d.year} Q${quarter}`;
      }),
    ),
  ].sort();

  // ---------------------------------------------------------
  // 2.2 Available regions
  // ---------------------------------------------------------

  const availableRegions = [
    "All",
    ...new Set(traffic.map((d) => d.region)),
  ].sort((a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)));

  // ---------------------------------------------------------
  // 2.3 Available technologies
  // ---------------------------------------------------------

  const availableTechnologies = [
    "All",
    ...new Set(incidents.map((d) => d.type)),
  ].sort((a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)));

  // ---------------------------------------------------------
  // 2.4 Top four manufacturers by incident count
  // ---------------------------------------------------------

  const manufacturerCounts = d3.rollups(
    incidents,
    (rows) => d3.sum(rows, (d) => d.incident_report_count),
    (d) => d.manufacturer,
  );

  const topManufacturers = manufacturerCounts
    .filter(([name]) => name != null && name !== "")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  const availableManufacturers = ["All", ...topManufacturers];

  // ---------------------------------------------------------
  // 2.5 Current filter selections
  // ---------------------------------------------------------

  const filters = {
    startDate: availableDates[0],
    endDate: availableDates[availableDates.length - 1],
    region: "All",
    technology: "All",
    manufacturer: "All",
  };

  // =========================================================
  // 3. DATA FILTERING AND AGGREGATION
  // =========================================================

  // ---------------------------------------------------------
  // 3.1 Quarter-based date filtering
  // ---------------------------------------------------------

  function inDateRange(d) {
    const quarter = Math.ceil(d.month / 3);
    const date = `${d.year} Q${quarter}`;

    return date >= filters.startDate && date <= filters.endDate;
  }

  // ---------------------------------------------------------
  // 3.2 Calculate hourly distributions and totals
  // ---------------------------------------------------------

  function aggregateHourly() {
    const filteredTraffic = traffic.filter(
      (d) =>
        inDateRange(d) &&
        (filters.region === "All" || d.region === filters.region),
    );

    const filteredIncidents = incidents.filter(
      (d) =>
        inDateRange(d) &&
        (filters.region === "All" || d.region === filters.region) &&
        (filters.technology === "All" || d.type === filters.technology) &&
        (filters.manufacturer === "All" ||
          d.manufacturer === filters.manufacturer),
    );

    // Aggregate traffic volume by hour
    const trafficByHour = d3.rollup(
      filteredTraffic,
      (rows) => d3.sum(rows, (d) => d.traffic_volume),
      (d) => d.hour,
    );

    // Aggregate incident reports by hour
    const incidentsByHour = d3.rollup(
      filteredIncidents,
      (rows) => d3.sum(rows, (d) => d.incident_report_count),
      (d) => d.hour,
    );

    const totalTraffic = d3.sum(trafficByHour.values());
    const totalIncidents = d3.sum(incidentsByHour.values());

    // Normalize each distribution independently to 100%
    const data = d3.range(24).map((hour) => ({
      hour,

      traffic_pct:
        totalTraffic > 0
          ? (100 * (trafficByHour.get(hour) || 0)) / totalTraffic
          : null,

      incident_pct:
        totalIncidents > 0
          ? (100 * (incidentsByHour.get(hour) || 0)) / totalIncidents
          : null,
    }));

    return {
      data,
      totalTraffic,
      totalIncidents,
    };
  }

  let currentResult = aggregateHourly();
  let currentData = currentResult.data;

  // =========================================================
  // 4. SCALES
  // =========================================================

  // ---------------------------------------------------------
  // 4.1 X-axis scale
  // ---------------------------------------------------------

  const x = d3.scaleLinear().domain([0, 23]).range([0, innerWidth]);

  // ---------------------------------------------------------
  // 4.2 Y-axis scale
  // ---------------------------------------------------------

  const y = d3.scaleLinear().range([innerHeight, 0]);

  function getYDomain(data) {
    const maxValue =
      d3.max(data, (d) => Math.max(d.traffic_pct ?? 0, d.incident_pct ?? 0)) ||
      1;

    return d3
      .scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .domain();
  }

  y.domain(getYDomain(currentData));

  // =========================================================
  // 5. CREATE SVG AND FILTER HEADER
  // =========================================================

  // ---------------------------------------------------------
  // 5.1 SVG container
  // ---------------------------------------------------------

  const svg = d3
    .create("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("class", "traffic-chart-svg");

  // ---------------------------------------------------------
  // 5.2 Header background
  // ---------------------------------------------------------

  svg
    .append("rect")
    .attr("x", 15)
    .attr("y", 10)
    .attr("width", width - 30)
    .attr("height", headerHeight)
    .attr("rx", 8)
    .attr("fill", colors.header)
    .attr("stroke", colors.border)
    .attr("stroke-width", 1);

  // =========================================================
  // 6. REUSABLE DROPDOWN HELPER
  // =========================================================

  function createDropdown(
    xPosition,
    label,
    options,
    initialValue,
    controlWidth = 150,
  ) {
    const control = svg
      .append("foreignObject")
      .attr("x", xPosition)
      .attr("y", 30)
      .attr("width", controlWidth + 10)
      .attr("height", 75);

    const container = control
      .append("xhtml:div")
      .attr("class", "traffic-filter");

    container
      .append("xhtml:label")
      .attr("class", "traffic-filter-label")
      .style("display", "block")
      .style("margin-bottom", "6px")
      .style("font-weight", "600")
      .text(label);

    const select = container
      .append("xhtml:select")
      .attr("class", "traffic-filter-select")
      .style("width", `${controlWidth}px`)
      .style("box-sizing", "border-box")
      .style("font", "inherit");

    select
      .selectAll("option")
      .data(options)
      .join("option")
      .attr("value", (d) => d)
      .text((d) => d);

    select.property("value", initialValue);

    return select;
  }

  // =========================================================
  // 7. FILTER DROPDOWNS — SINGLE ROW
  // =========================================================

  // ---------------------------------------------------------
  // 7.1 Start Date
  // ---------------------------------------------------------

  const startDateSelect = createDropdown(
    35,
    "Start Date",
    availableDates,
    filters.startDate,
    125,
  );

  // ---------------------------------------------------------
  // 7.2 End Date
  // ---------------------------------------------------------

  const endDateSelect = createDropdown(
    195,
    "End Date",
    availableDates,
    filters.endDate,
    125,
  );

  // ---------------------------------------------------------
  // 7.3 Region
  // ---------------------------------------------------------

  const regionSelect = createDropdown(
    355,
    "Region",
    availableRegions,
    filters.region,
    155,
  );

  // ---------------------------------------------------------
  // 7.4 Technology
  // ---------------------------------------------------------

  const technologySelect = createDropdown(
    545,
    "Technology",
    availableTechnologies,
    filters.technology,
    105,
  );

  // ---------------------------------------------------------
  // 7.5 Manufacturer
  // ---------------------------------------------------------

  const manufacturerSelect = createDropdown(
    685,
    "Manufacturer",
    availableManufacturers,
    filters.manufacturer,
    175,
  );

  // ---------------------------------------------------------
  // 7.6 Restrict End Date to Start Date or later
  // ---------------------------------------------------------

  function updateEndDates() {
    const validDates = availableDates.filter((d) => d >= filters.startDate);

    endDateSelect
      .selectAll("option")
      .data(validDates)
      .join("option")
      .attr("value", (d) => d)
      .text((d) => d);

    if (!validDates.includes(filters.endDate)) {
      filters.endDate = validDates[validDates.length - 1];
    }

    endDateSelect.property("value", filters.endDate);
  }

  // =========================================================
  // 8. FILTER SUMMARY AND INCIDENT COUNT
  // =========================================================

  // ---------------------------------------------------------
  // 8.1 Date range text
  // ---------------------------------------------------------

  const dateRangeText = svg
    .append("text")
    .attr("x", 35)
    .attr("y", 116)
    .attr("font-size", 12)
    .attr("fill", colors.secondaryText);

  function updateDateRangeText() {
    dateRangeText.text(`Showing: ${filters.startDate} – ${filters.endDate}`);
  }

  // ---------------------------------------------------------
  // 8.2 Incident count
  // ---------------------------------------------------------

  const incidentCountText = svg
    .append("text")
    .attr("x", 685)
    .attr("y", 116)
    .attr("text-anchor", "end")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .attr("fill", colors.secondaryText);

  function updateIncidentCount(totalIncidents) {
    incidentCountText.text(`Incidents: ${d3.format(",")(totalIncidents)}`);
  }

  updateDateRangeText();
  updateIncidentCount(currentResult.totalIncidents);

  // =========================================================
  // 9. CHART PLOTTING AREA
  // =========================================================

  // ---------------------------------------------------------
  // 9.1 Main plotting group
  // ---------------------------------------------------------

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ---------------------------------------------------------
  // 9.2 Horizontal gridlines
  // ---------------------------------------------------------

  const grid = g
    .append("g")
    .attr("stroke", colors.grid)
    .attr("stroke-opacity", 0.7);

  // ---------------------------------------------------------
  // 9.3 X-axis
  // ---------------------------------------------------------

  const xAxis = g
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(d3.range(24))
        .tickFormat((d) => `${d}:00`),
    );

  xAxis.select(".domain").attr("stroke", "var(--line)");

  xAxis
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // ---------------------------------------------------------
  // 9.4 Y-axis
  // ---------------------------------------------------------

  const yAxis = g.append("g").attr("class", "axis");

  const yAxisGenerator = () =>
    d3
      .axisLeft(y)
      .ticks(6)
      .tickFormat((d) => `${d}%`);

  // ---------------------------------------------------------
  // 9.5 Gridline renderer
  // ---------------------------------------------------------

  function drawGrid() {
    grid
      .selectAll("line")
      .data(y.ticks(6), (d) => d)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));
  }

  drawGrid();

  yAxis.call(yAxisGenerator());
  yAxis.select(".domain").remove();

  // =========================================================
  // 10. AXIS LABELS
  // =========================================================

  // ---------------------------------------------------------
  // 10.1 X-axis label
  // ---------------------------------------------------------

  svg
    .append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--ink)")
    .attr("font-size", 13)
    .text("Hour of Day");

  // ---------------------------------------------------------
  // 10.2 Y-axis label
  // ---------------------------------------------------------

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + innerHeight / 2))
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--ink)")
    .attr("font-size", 13)
    .text("Percentage of Total (%)");

  // =========================================================
  // 11. LINE GENERATOR
  // =========================================================

  function makeLine(key, yScale) {
    return d3
      .line()
      .defined((d) => d[key] != null)
      .x((d) => x(d.hour))
      .y((d) => yScale(d[key]));
  }

  // =========================================================
  // 12. DRAW DATA LINES
  // =========================================================

  // ---------------------------------------------------------
  // 12.1 ADS/ADAS incidents
  // ---------------------------------------------------------

  const incidentLine = g
    .append("path")
    .datum(currentData)
    .attr("fill", "none")
    .attr("stroke", colors.incidents)
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round")
    .attr("opacity", currentResult.totalIncidents > 0 ? 1 : 0)
    .attr("d", makeLine("incident_pct", y));

  // ---------------------------------------------------------
  // 12.2 General traffic
  // ---------------------------------------------------------

  const trafficLine = g
    .append("path")
    .datum(currentData)
    .attr("fill", "none")
    .attr("stroke", colors.traffic)
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round")
    .attr("d", makeLine("traffic_pct", y));

  // =========================================================
  // 13. LEGEND
  // =========================================================

  const legend = svg
    .append("g")
    .attr("transform", `translate(${margin.left + 10}, 145)`);

  const series = [
    {
      label: "ADS/ADAS Incidents",
      color: colors.incidents,
    },
    {
      label: "General Traffic",
      color: colors.traffic,
    },
  ];

  series.forEach((s, i) => {
    const item = legend
      .append("g")
      .attr("transform", `translate(${i * 210}, 0)`);

    item
      .append("line")
      .attr("x1", 0)
      .attr("x2", 28)
      .attr("stroke", s.color)
      .attr("stroke-width", 3);

    item
      .append("text")
      .attr("x", 36)
      .attr("y", 4)
      .attr("font-size", 13)
      .attr("fill", "var(--ink)")
      .text(s.label);
  });

  // =========================================================
  // 14. EMPTY-RESULT MESSAGE
  // =========================================================

  // ---------------------------------------------------------
  // 14.1 Message container
  // ---------------------------------------------------------

  const emptyMessage = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, 163)`)
    .attr("opacity", currentResult.totalIncidents === 0 ? 1 : 0)
    .style("pointer-events", "none");

  // ---------------------------------------------------------
  // 14.2 Information icon
  // ---------------------------------------------------------

  emptyMessage
    .append("circle")
    .attr("cx", 7)
    .attr("cy", 0)
    .attr("r", 7)
    .attr("fill", "var(--cloudy)");

  emptyMessage
    .append("text")
    .attr("x", 7)
    .attr("y", 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-weight", 700)
    .attr("fill", "var(--card)")
    .text("i");

  // ---------------------------------------------------------
  // 14.3 Informational text
  // ---------------------------------------------------------

  emptyMessage
    .append("text")
    .attr("x", 20)
    .attr("y", 4)
    .attr("font-size", 12)
    .attr("fill", colors.secondaryText)
    .text(
      "No incidents match the selected filters. Try a different technology or manufacturer.",
    );

  // =========================================================
  // 15. SHARED ANIMATED CHART UPDATE
  // =========================================================

  // ---------------------------------------------------------
  // 15.1 Current displayed state
  // ---------------------------------------------------------

  let displayedData = currentData;
  let displayedY = y.copy();

  // ---------------------------------------------------------
  // 15.2 Interpolate hourly values between filter states
  // ---------------------------------------------------------

  function animateLine(path, key, fromData, toData, fromY, toY, transition) {
    path.transition(transition).attrTween("d", function () {
      return function (t) {
        const interpolatedY = fromY
          .copy()
          .domain(d3.interpolateArray(fromY.domain(), toY.domain())(t));

        const interpolatedData = toData.map((d, i) => {
          const oldValue = fromData[i][key];
          const newValue = d[key];

          return {
            hour: d.hour,
            [key]:
              oldValue == null || newValue == null
                ? t < 1
                  ? oldValue
                  : newValue
                : d3.interpolateNumber(oldValue, newValue)(t),
          };
        });

        return makeLine(key, interpolatedY)(interpolatedData) || "";
      };
    });
  }

  // ---------------------------------------------------------
  // 15.3 Shared update function
  // ---------------------------------------------------------

  function updateChart() {
    const nextResult = aggregateHourly();
    const nextData = nextResult.data;

    const fromData = displayedData;
    const fromY = displayedY.copy();

    const nextY = y.copy().domain(getYDomain(nextData));

    // Stop previous chart animations
    svg.selectAll("*").interrupt();

    const t = svg
      .transition()
      .duration(transitionDuration)
      .ease(transitionEase);

    // -------------------------------------------------------
    // Animate incident line
    // -------------------------------------------------------

    animateLine(
      incidentLine,
      "incident_pct",
      fromData,
      nextData,
      fromY,
      nextY,
      t,
    );

    incidentLine
      .transition(t)
      .attr("opacity", nextResult.totalIncidents > 0 ? 1 : 0);

    // -------------------------------------------------------
    // Animate traffic line
    // -------------------------------------------------------

    animateLine(
      trafficLine,
      "traffic_pct",
      fromData,
      nextData,
      fromY,
      nextY,
      t,
    );

    // -------------------------------------------------------
    // Animate y-axis
    // -------------------------------------------------------

    y.domain(nextY.domain());

    yAxis
      .transition(t)
      .call(yAxisGenerator())
      .on("end", function () {
        d3.select(this).select(".domain").remove();
      });

    // -------------------------------------------------------
    // Animate gridlines
    // -------------------------------------------------------

    grid
      .selectAll("line")
      .data(y.ticks(6), (d) => d)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", (d) => fromY(d))
            .attr("y2", (d) => fromY(d)),
        (update) => update,
        (exit) => exit.transition(t).attr("opacity", 0).remove(),
      )
      .transition(t)
      .attr("opacity", 1)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d));

    // -------------------------------------------------------
    // Animate empty-result message
    // -------------------------------------------------------

    emptyMessage
      .transition(t)
      .attr("opacity", nextResult.totalIncidents === 0 ? 1 : 0);

    // -------------------------------------------------------
    // Update filter summary
    // -------------------------------------------------------

    updateDateRangeText();
    updateIncidentCount(nextResult.totalIncidents);

    // -------------------------------------------------------
    // Store new state
    // -------------------------------------------------------

    currentResult = nextResult;
    currentData = nextData;
    displayedData = nextData;
    displayedY = nextY.copy();
  }

  // =========================================================
  // 16. FILTER EVENT HANDLERS
  // =========================================================

  // ---------------------------------------------------------
  // 16.1 Start Date
  // ---------------------------------------------------------

  startDateSelect.on("change", function () {
    filters.startDate = this.value;

    updateEndDates();
    updateChart();
  });

  // ---------------------------------------------------------
  // 16.2 End Date
  // ---------------------------------------------------------

  endDateSelect.on("change", function () {
    filters.endDate = this.value;
    updateChart();
  });

  // ---------------------------------------------------------
  // 16.3 Region
  // ---------------------------------------------------------

  regionSelect.on("change", function () {
    filters.region = this.value;
    updateChart();
  });

  // ---------------------------------------------------------
  // 16.4 Technology
  // ---------------------------------------------------------

  technologySelect.on("change", function () {
    filters.technology = this.value;
    updateChart();
  });

  // ---------------------------------------------------------
  // 16.5 Manufacturer
  // ---------------------------------------------------------

  manufacturerSelect.on("change", function () {
    filters.manufacturer = this.value;
    updateChart();
  });

  // =========================================================
  // 17. RETURN SVG
  // =========================================================

  return svg.node();
};
const _6 = function hourlyData(traffic, incidents, d3) {
  // Version 1: Default selections (all data)
  const startYear = 2022;
  const startMonth = 1;
  const endYear = 2025;
  const endMonth = 12;

  const selectedRegion = "All";
  const selectedTechnology = "All";
  const selectedManufacturer = "All";

  // Helper for inclusive month-range filtering
  const inDateRange = (d) => {
    const date = d.year * 12 + d.month;
    return (
      date >= startYear * 12 + startMonth && date <= endYear * 12 + endMonth
    );
  };

  // Apply shared filters to traffic
  const filteredTraffic = traffic.filter(
    (d) =>
      inDateRange(d) &&
      (selectedRegion === "All" || d.region === selectedRegion),
  );

  // Apply shared and incident-specific filters
  const filteredIncidents = incidents.filter(
    (d) =>
      inDateRange(d) &&
      (selectedRegion === "All" || d.region === selectedRegion) &&
      (selectedTechnology === "All" || d.type === selectedTechnology) &&
      (selectedManufacturer === "All" ||
        d.manufacturer === selectedManufacturer),
  );

  // Aggregate traffic volume by hour
  const trafficByHour = d3.rollup(
    filteredTraffic,
    (v) => d3.sum(v, (d) => d.traffic_volume),
    (d) => d.hour,
  );

  // Aggregate incidents by hour
  const incidentsByHour = d3.rollup(
    filteredIncidents,
    (v) => d3.sum(v, (d) => d.incident_report_count),
    (d) => d.hour,
  );

  // Calculate totals after filtering
  const totalTraffic = d3.sum(trafficByHour.values());
  const totalIncidents = d3.sum(incidentsByHour.values());

  // Generate 24 hourly records
  return d3.range(24).map((hour) => ({
    hour,
    traffic_pct:
      totalTraffic > 0
        ? (100 * (trafficByHour.get(hour) || 0)) / totalTraffic
        : null,
    incident_pct:
      totalIncidents > 0
        ? (100 * (incidentsByHour.get(hour) || 0)) / totalIncidents
        : null,
  }));
};
const _5 = function validation(traffic, d3, incidents) {
  const regions = (data) => [...new Set(data.map((d) => d.region))].sort();
  const years = (data) => [...new Set(data.map((d) => d.year))].sort();
  const hours = (data) =>
    [...new Set(data.map((d) => d.hour))].sort((a, b) => a - b);

  const results = [
    {
      dataset: "Traffic",
      rows: traffic.length,
      regions: regions(traffic).length,
      years: years(traffic).join(", "),
      hours: hours(traffic).length,
      total: d3.sum(traffic, (d) => d.traffic_volume),
    },
    {
      dataset: "Incidents",
      rows: incidents.length,
      regions: regions(incidents).length,
      years: years(incidents).join(", "),
      hours: hours(incidents).length,
      total: d3.sum(incidents, (d) => d.incident_report_count),
    },
  ];

  return results;
};
const _3 = function incidents(FileAttachment) {
  return FileAttachment("hourly_incidents_d3.csv").csv({ typed: true });
};

const _2 = function traffic(FileAttachment) {
  return FileAttachment("hourly_traffic_d3.csv").csv({ typed: true });
};

export default function define(runtime) {
  const main = runtime.module();
  const files = [
    {
      name: "hourly_traffic_d3.csv",
      href: "/static/data/hourly_traffic_d3.csv",
      mimeType: "text/csv",
    },
    {
      name: "hourly_incidents_d3.csv",
      href: "/static/data/hourly_incidents_d3.csv",
      mimeType: "text/csv",
    },
  ];
  main.builtin(
    "FileAttachment",
    runtime.fileAttachments((name) => {
      const file = files.find((d) => d.name === name);
      return file ? file.href : null;
    }),
  );
  main.define("cell 1", ["md"], _1);
  main.define("chart", ["d3", "traffic", "incidents"], _7);
  main.define("hourlyData", ["traffic", "incidents", "d3"], _6);
  main.define("validation", ["traffic", "d3", "incidents"], _5);
  main.define("incidents", ["FileAttachment"], _3);
  main.define("traffic", ["FileAttachment"], _2);
  return main;
}

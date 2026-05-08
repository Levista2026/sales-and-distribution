const SUPABASE_URL = "https://leyiexbcueohoewidaof.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wH-NBUQEVxOCO_lK2XjaNQ_GiyDeUqr";

const tableInput = document.getElementById("tableName");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const statusEl = document.getElementById("status");

const rsmFilter = document.getElementById("rsmFilter");
const asmFilter = document.getElementById("asmFilter");
const userFilter = document.getElementById("userFilter");
const monthFromFilter = document.getElementById("monthFromFilter");
const monthToFilter = document.getElementById("monthToFilter");
const rsmFilterList = document.getElementById("rsmFilterList");
const asmFilterList = document.getElementById("asmFilterList");
const userFilterList = document.getElementById("userFilterList");
const monthFromFilterList = document.getElementById("monthFromFilterList");
const monthToFilterList = document.getElementById("monthToFilterList");

const chartDefs = [
  { id: "chart-no-ols", key: "noOfOls", label: "No of Ols", color: "#1f5f96", isPercent: false },
  { id: "chart-tc", key: "tc", label: "TC", color: "#d67f2b", isPercent: false },
  { id: "chart-pc", key: "pc", label: "PC", color: "#2f855a", isPercent: false },
  { id: "chart-percent", key: "percent", label: "%", color: "#8b5cf6", isPercent: true },
  { id: "chart-ubo", key: "ubo", label: "UBO", color: "#b45309", isPercent: false },
  { id: "chart-ubo-percent", key: "uboPercent", label: "UBO %", color: "#0f766e", isPercent: true },
  { id: "chart-lpc", key: "lpcDerived", label: "LPC", color: "#be185d", isPercent: false },
  { id: "chart-sec-value", key: "secValue", label: "Sec Value", color: "#1d4ed8", isPercent: false },
  { id: "chart-sec-volume", key: "secVolume", label: "Sec Volume", color: "#0f766e", isPercent: false }
];

let allRows = [];
const chartInstances = {};
const monthRankMap = new Map();

// [TAG:CHART_QUALITY] Improve rendering clarity on high-DPI/zoomed displays.
Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);

const monthLookup = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b42318" : "#1f6a33";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMonthValue(monthText) {
  if (!monthText) return null;
  const raw = String(monthText).trim();
  const ymdMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const yearNum = Number.parseInt(ymdMatch[1], 10);
    const monthNum = Number.parseInt(ymdMatch[2], 10);
    if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;
    return { monthIndex: monthNum - 1, yearNum, rank: yearNum * 12 + (monthNum - 1) };
  }

  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    let yearNum = Number.parseInt(dmyMatch[3], 10);
    if (dmyMatch[3].length <= 2) yearNum += 2000;
    const monthNum = Number.parseInt(dmyMatch[2], 10);
    if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;
    return { monthIndex: monthNum - 1, yearNum, rank: yearNum * 12 + (monthNum - 1) };
  }

  // Support month labels like "Apr-25", "Apr 25", and "Apr25".
  const monthYearMatch = raw.match(/^([A-Za-z]{3,9})\s*[-/]?\s*(\d{2,4})$/);
  if (!monthYearMatch) return null;

  const monthIndex = monthLookup[monthYearMatch[1].slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) return null;

  const yearPart = monthYearMatch[2].replace(/[^0-9]/g, "");
  let yearNum = Number.parseInt(yearPart, 10);
  if (!Number.isFinite(yearNum)) return null;
  if (yearPart.length <= 2) yearNum += 2000;

  return { monthIndex, yearNum, rank: yearNum * 12 + monthIndex };
}

function normalizeMonthLabel(monthText) {
  const parsed = parseMonthValue(monthText);
  if (!parsed) return String(monthText || "").trim();
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parsed.monthIndex];
  const yearShort = String(parsed.yearNum).slice(-2);
  return `${monthShort} ${yearShort}`;
}

// [TAG:MONTH_KEYS] Canonical month key used for reliable sorting/filtering.
function getMonthKey(monthText) {
  return normalizeMonthLabel(monthText);
}

function sortMonths(months) {
  return [...months].sort((a, b) => {
    const pa = parseMonthValue(a);
    const pb = parseMonthValue(b);
    if (!pa && !pb) return String(a).localeCompare(String(b));
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.rank - pb.rank;
  });
}

function fillDatalist(inputEl, listEl, values, keepSelected = true) {
  const selectedBefore = keepSelected ? inputEl.value : "";
  listEl.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    listEl.appendChild(option);
  });
  inputEl.value = values.includes(selectedBefore) ? selectedBefore : "";
}

// [TAG:FILTER_SEARCH] Search helper for dropdown source values.
function filterValuesBySearch(values, searchText) {
  const q = String(searchText || "").trim().toLowerCase();
  if (!q) return values;
  return values.filter((value) => String(value).toLowerCase().includes(q));
}

function clearSelections(inputEl) {
  inputEl.value = "";
}

function getUniqueSorted(rows, key, isMonth = false) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))];
  return isMonth ? sortMonths(values) : values.sort();
}

function rowsByRsm() {
  if (!rsmFilter.value) return allRows;
  return allRows.filter((row) => row.current_rsm === rsmFilter.value);
}

function rowsByRsmAsm() {
  const byRsm = rowsByRsm();
  if (!asmFilter.value) return byRsm;
  return byRsm.filter((row) => row.current_asm === asmFilter.value);
}

function rebuildFilterOptions() {
  const rsmValues = getUniqueSorted(allRows, "current_rsm");
  const asmValues = getUniqueSorted(rowsByRsm(), "current_asm");
  const userValues = getUniqueSorted(rowsByRsmAsm(), "so");
  const monthValues = getUniqueSorted(allRows.map((row) => ({ month_key: getMonthKey(row.month) })), "month_key", true);

  fillDatalist(rsmFilter, rsmFilterList, rsmValues, true);
  fillDatalist(asmFilter, asmFilterList, asmValues, true);
  fillDatalist(userFilter, userFilterList, userValues, true);
  fillDatalist(monthFromFilter, monthFromFilterList, monthValues, true);
  fillDatalist(monthToFilter, monthToFilterList, monthValues, true);
}

function applyFilters() {
  return allRows.filter((row) => {
    const monthKey = getMonthKey(row.month);
    if (rsmFilter.value && row.current_rsm !== rsmFilter.value) return false;
    if (asmFilter.value && row.current_asm !== asmFilter.value) return false;
    if (userFilter.value && row.so !== userFilter.value) return false;
    if (monthFromFilter.value) {
      const fromRank = monthRankMap.get(monthFromFilter.value);
      const rowRank = monthRankMap.get(monthKey);
      if (Number.isFinite(fromRank) && Number.isFinite(rowRank) && rowRank < fromRank) return false;
    }
    if (monthToFilter.value) {
      const toRank = monthRankMap.get(monthToFilter.value);
      const rowRank = monthRankMap.get(monthKey);
      if (Number.isFinite(toRank) && Number.isFinite(rowRank) && rowRank > toRank) return false;
    }
    return true;
  });
}

function safeDivide(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

function aggregateByMonth(rows, metricKey) {
  const monthMap = new Map();

  rows.forEach((row) => {
    const month = getMonthKey(row.month);
    if (!month) return;
    const current = monthMap.get(month) || {
      noOfOls: 0,
      tc: 0,
      pc: 0,
      ubo: 0,
      tlsd: 0,
      secValue: 0,
      secVolume: 0
    };

    current.noOfOls += parseNumber(row.no_of_ols);
    current.tc += parseNumber(row.tc);
    current.pc += parseNumber(row.pc);
    current.ubo += parseNumber(row.ubo);
    current.tlsd += parseNumber(row.tlsd);
    current.secValue += parseNumber(row.sec_value);
    current.secVolume += parseNumber(row.sec_volume);

    monthMap.set(month, current);
  });

  const labels = sortMonths([...monthMap.keys()]);
  const data = labels.map((label) => {
    const m = monthMap.get(label);
    if (!m) return 0;
    if (metricKey === "noOfOls") return m.noOfOls;
    if (metricKey === "tc") return m.tc;
    if (metricKey === "pc") return m.pc;
    if (metricKey === "ubo") return m.ubo;
    if (metricKey === "secValue") return m.secValue / 100000;
    if (metricKey === "secVolume") return m.secVolume / 1000;
    if (metricKey === "lpcDerived") return safeDivide(m.tlsd, m.pc);
    if (metricKey === "uboPercent") return safeDivide(m.ubo, m.noOfOls) * 100;
    if (metricKey === "percent") return Math.round(safeDivide(m.pc, m.tc) * 100);
    return 0;
  });

  return { labels, data };
}

function formatTick(value) {
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function drawChart(def, labels, values) {
  const canvas = document.getElementById(def.id);
  if (!canvas) return;

  const isSinglePoint = labels.length === 1;
  const renderLabels = isSinglePoint ? [labels[0], `${labels[0]} `] : labels;
  const renderValues = isSinglePoint ? [values[0], values[0]] : values;

  // [TAG:LINE_SMOOTHING] Smooth plotted values to avoid sharp visual drops.
  const smoothedValues = renderValues.map((value, index, arr) => {
    if (arr.length < 3 || index === 0 || index === arr.length - 1) return value;
    const prev = arr[index - 1];
    const next = arr[index + 1];
    return (prev + value + next) / 3;
  });

  const dataset = {
    label: def.label,
    data: smoothedValues,
    borderColor: def.color,
    backgroundColor: `${def.color}33`,
    pointBackgroundColor: def.color,
    pointBorderColor: def.color,
    borderWidth: 3,
    fill: true,
    showLine: true,
    tension: 0.42,
    pointRadius: 4,
    pointHoverRadius: 6
  };

  // [TAG:Y_AXIS_BALANCE] Keep trend readability similar to business dashboards
  // by using an adaptive y-axis range instead of always starting at zero.
  const finiteValues = smoothedValues.filter((v) => Number.isFinite(v));
  const minVal = finiteValues.length ? Math.min(...finiteValues) : 0;
  const maxVal = finiteValues.length ? Math.max(...finiteValues) : 0;
  const range = Math.max(maxVal - minVal, 1);
  const padRatio = def.isPercent ? 0.08 : 0.12;
  const pad = range * padRatio;
  const yMin = Math.max(0, minVal - pad);
  const yMax = maxVal + pad;

  if (chartInstances[def.id]) {
    chartInstances[def.id].data.labels = renderLabels;
    chartInstances[def.id].data.datasets = [dataset];
    chartInstances[def.id].options.scales.y.min = yMin;
    chartInstances[def.id].options.scales.y.max = yMax;
    chartInstances[def.id].update();
    return;
  }

  chartInstances[def.id] = new Chart(canvas, {
    type: "line",
    data: { labels: renderLabels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 26,
          right: 24,
          left: 10
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          display: true,
          align: "top",
          anchor: "end",
          clamp: true,
          clip: false,
          offset: 4,
          color: def.color,
          font: (ctx) => ({
            weight: "700",
            size: ctx.chart.width < 520 ? 8 : 9
          }),
          formatter: (value) => (def.isPercent ? `${formatTick(value)}%` : formatTick(value))
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 35,
            minRotation: 25,
            autoSkip: true
          }
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            callback: (value) => (def.isPercent ? `${formatTick(value)}%` : formatTick(value))
          }
        }
      }
    }
  });
}

if (window.ChartDataLabels) {
  Chart.register(window.ChartDataLabels);
}

function refreshDashboard() {
  const filteredRows = applyFilters();
  chartDefs.forEach((def) => {
    const { labels, data } = aggregateByMonth(filteredRows, def.key);
    drawChart(def, labels, data);
  });
  setStatus(`Showing ${filteredRows.length} row(s) after filters.`);
}

function onHierarchyFilterChange() {
  rebuildFilterOptions();
  refreshDashboard();
}

function clearFilters() {
  clearSelections(rsmFilter);
  clearSelections(asmFilter);
  clearSelections(userFilter);
  clearSelections(monthFromFilter);
  clearSelections(monthToFilter);
  rebuildFilterOptions();
  refreshDashboard();
}

async function fetchAllRowsFromTable(client, tableName) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client.from(tableName).select("*").range(from, to);
    if (error) return { data: null, error };

    const chunk = Array.isArray(data) ? data : [];
    all = all.concat(chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}

async function loadData() {
  const tableName = tableInput.value.trim();
  if (!tableName) {
    setStatus("Please enter a table name.", true);
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    setStatus("Supabase SDK failed to load.", true);
    return;
  }

  try {
    setStatus(`Loading data from '${tableName}'...`);
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const candidateTables = [...new Set([tableName, "S&D", "Supabase - S&D", "S&D Data"].filter(Boolean))];
    let result = null;

    for (const candidate of candidateTables) {
      const attempt = await fetchAllRowsFromTable(client, candidate);
      if (!attempt.error) {
        result = attempt;
        if (candidate !== tableName) {
          tableInput.value = candidate;
        }
        break;
      }
      result = attempt;
    }

    if (!result || result.error) {
      setStatus(`Error: ${result.error.message}`, true);
      return;
    }

    allRows = Array.isArray(result.data) ? result.data : [];
    monthRankMap.clear();
    allRows.forEach((row) => {
      const key = getMonthKey(row.month);
      const parsed = parseMonthValue(key);
      if (parsed) monthRankMap.set(key, parsed.rank);
    });
    rebuildFilterOptions();
    refreshDashboard();

    if (allRows.length === 0) {
      setStatus("No rows returned from Supabase. Check table name and RLS read policy for anon.", true);
    } else {
      setStatus(`Loaded ${allRows.length} row(s). Showing all months oldest to newest.`, false);
    }
  } catch (err) {
    setStatus(`Unexpected error: ${err.message}`, true);
  }
}

rsmFilter.addEventListener("change", onHierarchyFilterChange);
asmFilter.addEventListener("change", onHierarchyFilterChange);
userFilter.addEventListener("change", refreshDashboard);
monthFromFilter.addEventListener("change", refreshDashboard);
monthToFilter.addEventListener("change", refreshDashboard);
clearFiltersBtn.addEventListener("click", clearFilters);

window.addEventListener("load", () => {
  loadData();
});

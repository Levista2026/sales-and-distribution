const monthLookup = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseMonthValue(monthText) {
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

  const monthYearMatch = raw.match(/^([A-Za-z]{3,9})\s*[-/]?\s*(\d{2,4})$/);
  if (!monthYearMatch) return null;

  const monthIndex = monthLookup[monthYearMatch[1].slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) return null;

  const yearPart = monthYearMatch[2].replace(/[^0-9]/g, '');
  let yearNum = Number.parseInt(yearPart, 10);
  if (!Number.isFinite(yearNum)) return null;
  if (yearPart.length <= 2) yearNum += 2000;

  return { monthIndex, yearNum, rank: yearNum * 12 + monthIndex };
}

export function normalizeMonthLabel(monthText) {
  const parsed = parseMonthValue(monthText);
  if (!parsed) return String(monthText || '').trim();
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parsed.monthIndex];
  const yearShort = String(parsed.yearNum).slice(-2);
  return `${monthShort} ${yearShort}`;
}

export function getMonthKey(monthText) {
  return normalizeMonthLabel(monthText);
}

export function sortMonths(months) {
  return [...months].sort((a, b) => {
    const pa = parseMonthValue(a);
    const pb = parseMonthValue(b);
    if (!pa && !pb) return String(a).localeCompare(String(b));
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.rank - pb.rank;
  });
}

export function safeDivide(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

const METRIC_DEFINITIONS = {
  noOfOls: { source: 'no_of_ols', aggregate: 'sum' },
  tc: { source: 'tc', aggregate: 'sum' },
  pc: { source: 'pc', aggregate: 'sum' },
  percent: { aggregate: 'derived' },
  ubo: { source: 'ubo', aggregate: 'sum' },
  uboPercent: { aggregate: 'derived' },
  lpc: { aggregate: 'derived' },
  lpcDerived: { aggregate: 'derived', aliasFor: 'lpc' },
  secValue: { source: 'sec_value', aggregate: 'sum', scale: 100000 },
  secVolume: { source: 'sec_volume', aggregate: 'sum', scale: 1000 }
};

export function aggregateByMonth(rows, metricKey) {
  const definition = METRIC_DEFINITIONS[metricKey] || METRIC_DEFINITIONS[metricKey === 'lpcDerived' ? 'lpcDerived' : metricKey];
  const resolvedMetricKey = definition?.aliasFor || metricKey;
  const resolvedDefinition = METRIC_DEFINITIONS[resolvedMetricKey];
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
    if (resolvedMetricKey === 'noOfOls') return m.noOfOls;
    if (resolvedMetricKey === 'tc') return m.tc;
    if (resolvedMetricKey === 'pc') return m.pc;
    if (resolvedMetricKey === 'ubo') return m.ubo;
    if (resolvedMetricKey === 'secValue') return m.secValue / (resolvedDefinition?.scale || 1);
    if (resolvedMetricKey === 'secVolume') return m.secVolume / (resolvedDefinition?.scale || 1);
    if (resolvedMetricKey === 'lpc') return safeDivide(m.tlsd, m.pc);
    if (resolvedMetricKey === 'uboPercent') return safeDivide(m.ubo, m.noOfOls) * 100;
    if (resolvedMetricKey === 'percent') return Math.round(safeDivide(m.pc, m.tc) * 100);
    return 0;
  });

  return { labels, data };
}

export function getChartMetricKeys() {
  return ['noOfOls', 'tc', 'pc', 'percent', 'ubo', 'uboPercent', 'lpc', 'secValue', 'secVolume'];
}

export function getUniqueSorted(rows, key, isMonth = false) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))];
  return isMonth ? sortMonths(values) : values.sort();
}

export function fetchAllRowsFromTable(client, tableName) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  return (async () => {
    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await client.from(tableName).select('*').range(from, to);
      if (error) return { data: null, error };

      const chunk = Array.isArray(data) ? data : [];
      all = all.concat(chunk);

      if (chunk.length < pageSize) break;
      from += pageSize;
    }

    return { data: all, error: null };
  })();
}

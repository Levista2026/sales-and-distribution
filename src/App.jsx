import { useEffect, useMemo, useState } from 'react';
import Dashboard from './components/Dashboard';
import {
  aggregateByMonth,
  fetchAllRowsFromTable,
  getChartMetricKeys,
  getMonthKey,
  getUniqueSorted,
  parseMonthValue,
  sortMonths
} from './lib/dashboard';
import { supabaseClient } from './lib/supabase';

const DEFAULT_TABLE = 'S&D';
const DEFAULT_FILTERS = {
  rsm: [],
  asm: [],
  so: [],
  monthRange: 'last_12',
  monthFrom: '',
  monthTo: ''
};
const MONTH_RANGE_OPTIONS = {
  last_3: 3,
  last_6: 6,
  last_12: 12
};

function buildChartMap(rows) {
  return getChartMetricKeys().reduce((acc, key) => {
    const { labels, data } = aggregateByMonth(rows, key);
    acc[key] = { labels, values: data };
    return acc;
  }, {});
}

export default function App() {
  const [tableName, setTableName] = useState(DEFAULT_TABLE);
  const [allRows, setAllRows] = useState([]);
  const [status, setStatus] = useState('Initializing...');
  const [statusError, setStatusError] = useState(false);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const table = tableName.trim();
      if (!table) {
        setStatus('Please enter a table name.');
        setStatusError(true);
        return;
      }

      try {
        setStatus(`Loading data from '${table}'...`);
        setStatusError(false);

        const candidateTables = [...new Set([table, 'S&D', 'Supabase - S&D', 'S&D Data'].filter(Boolean))];
        let result = null;

        for (const candidate of candidateTables) {
          const attempt = await fetchAllRowsFromTable(supabaseClient, candidate);
          if (!attempt.error) {
            result = attempt;
            if (candidate !== table) {
              setTableName(candidate);
            }
            break;
          }
          result = attempt;
        }

        if (cancelled) return;

        if (!result || result.error) {
          setStatus(`Error: ${result?.error?.message || 'Unable to load table'}`);
          setStatusError(true);
          return;
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        setAllRows(rows);

        if (rows.length === 0) {
          setStatus('No rows returned from Supabase. Check table name and RLS read policy for anon.');
          setStatusError(true);
        } else {
          setStatus('');
          setStatusError(false);
        }
      } catch (error) {
        if (cancelled) return;
        setStatus(`Unexpected error: ${error.message}`);
        setStatusError(true);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [tableName]);

  const monthRankMap = useMemo(() => {
    const map = new Map();
    allRows.forEach((row) => {
      const key = getMonthKey(row.month);
      const parsed = parseMonthValue(key);
      if (parsed) map.set(key, parsed.rank);
    });
    return map;
  }, [allRows]);

  const monthTimeline = useMemo(() => {
    return sortMonths([...monthRankMap.keys()]);
  }, [monthRankMap]);

  const latestMonthRank = useMemo(() => {
    if (!monthTimeline.length) return null;
    const latestKey = monthTimeline[monthTimeline.length - 1];
    const latest = monthRankMap.get(latestKey);
    return Number.isFinite(latest) ? latest : null;
  }, [monthTimeline, monthRankMap]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      const monthKey = getMonthKey(row.month);
      const rowRank = monthRankMap.get(monthKey);
      if (filters.rsm.length && !filters.rsm.includes(row.current_rsm)) return false;
      if (filters.asm.length && !filters.asm.includes(row.current_asm)) return false;
      if (filters.so.length && !filters.so.includes(row.so)) return false;

      if (filters.monthRange && latestMonthRank !== null) {
        const monthsBack = MONTH_RANGE_OPTIONS[filters.monthRange];
        if (monthsBack) {
          const rangeStart = latestMonthRank - (monthsBack - 1);
          if (!Number.isFinite(rowRank) || rowRank < rangeStart || rowRank > latestMonthRank) return false;
        }
      }

      if (!filters.monthRange && filters.monthFrom) {
        const fromRank = monthRankMap.get(filters.monthFrom);
        if (Number.isFinite(fromRank) && Number.isFinite(rowRank) && rowRank < fromRank) return false;
      }

      if (!filters.monthRange && filters.monthTo) {
        const toRank = monthRankMap.get(filters.monthTo);
        if (Number.isFinite(toRank) && Number.isFinite(rowRank) && rowRank > toRank) return false;
      }

      return true;
    });
  }, [allRows, filters, latestMonthRank, monthRankMap]);

  const hierarchyRows = useMemo(() => {
    const byRsm = filters.rsm.length ? allRows.filter((row) => filters.rsm.includes(row.current_rsm)) : allRows;
    const byRsmAsm = filters.asm.length ? byRsm.filter((row) => filters.asm.includes(row.current_asm)) : byRsm;
    return {
      rsm: allRows,
      asm: byRsm,
      so: byRsmAsm
    };
  }, [allRows, filters.asm, filters.rsm]);

  const datalists = useMemo(() => {
    return {
      rsm: getUniqueSorted(hierarchyRows.rsm, 'current_rsm'),
      asm: getUniqueSorted(hierarchyRows.asm, 'current_asm'),
      so: getUniqueSorted(hierarchyRows.so, 'so'),
      month: monthTimeline
    };
  }, [hierarchyRows, monthTimeline]);

  const charts = useMemo(() => buildChartMap(filteredRows), [filteredRows]);

  function handleFilterChange(key, value) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'monthRange' && value) {
        next.monthFrom = '';
        next.monthTo = '';
      }
      return next;
    });
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <Dashboard
      tableName={tableName}
      onTableNameChange={setTableName}
      onClearFilters={clearFilters}
      status={status}
      statusError={statusError}
      filters={filters}
      datalists={datalists}
      onFilterChange={handleFilterChange}
      charts={charts}
      filtersPanelOpen={filtersPanelOpen}
      onToggleFiltersPanel={() => setFiltersPanelOpen((current) => !current)}
      onCloseFiltersPanel={() => setFiltersPanelOpen(false)}
      latestMonthLabel={monthTimeline[monthTimeline.length - 1] || ''}
    />
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import TrendChartCard from './TrendChartCard';

export default function Dashboard({
  onClearFilters,
  status,
  statusError,
  filters,
  datalists,
  onFilterChange,
  charts,
  filtersPanelOpen,
  onToggleFiltersPanel,
  onCloseFiltersPanel
}) {
  const [searchTerms, setSearchTerms] = useState({ rsm: '', asm: '', so: '' });
  const [openGroup, setOpenGroup] = useState(null);
  const panelRef = useRef(null);

  const chartCards = [
    { id: 'chart-no-ols', title: 'No of Ols', key: 'noOfOls', color: '#1f5f96', isPercent: false, noDecimals: true },
    { id: 'chart-tc', title: 'TC', key: 'tc', color: '#d67f2b', isPercent: false, noDecimals: true },
    { id: 'chart-pc', title: 'PC', key: 'pc', color: '#2f855a', isPercent: false, noDecimals: true },
    { id: 'chart-percent', title: '%', key: 'percent', color: '#8b5cf6', isPercent: true },
    { id: 'chart-ubo', title: 'UBO', key: 'ubo', color: '#b45309', isPercent: false, noDecimals: true },
    { id: 'chart-ubo-percent', title: 'UBO %', key: 'uboPercent', color: '#0f766e', isPercent: true },
    { id: 'chart-lpc', title: 'LPC', key: 'lpc', color: '#be185d', isPercent: false },
    { id: 'chart-sec-value', title: 'Sec Value', key: 'secValue', color: '#1d4ed8', isPercent: false },
    { id: 'chart-sec-volume', title: 'Sec Volume', key: 'secVolume', color: '#0f766e', isPercent: false }
  ];

  const filterSpecs = useMemo(() => ([
    { key: 'rsm', label: 'Current RSM', placeholder: 'Search RSM', options: datalists.rsm, selected: filters.rsm },
    { key: 'asm', label: 'Current ASM', placeholder: 'Search ASM', options: datalists.asm, selected: filters.asm },
    { key: 'so', label: 'SO', placeholder: 'Search SO', options: datalists.so, selected: filters.so }
  ]), [datalists.asm, datalists.rsm, datalists.so, filters.asm, filters.rsm, filters.so]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!filtersPanelOpen) return;
      const root = panelRef.current;
      if (root && !root.contains(event.target)) {
        onCloseFiltersPanel();
        setOpenGroup(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [filtersPanelOpen, onCloseFiltersPanel]);

  function handleClearFilters() {
    setSearchTerms({ rsm: '', asm: '', so: '' });
    setOpenGroup(null);
    onClearFilters();
  }

  function openDropdown(key) {
    setOpenGroup((current) => (current === key ? null : key));
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>S&amp;D Dashboard</h1>
        </div>
        <button className="mobile-filter-toggle" type="button" onClick={onToggleFiltersPanel}>
          Filters
        </button>
      </header>

      <section className="dashboard-layout">
        {filtersPanelOpen && <button type="button" className="filters-panel-backdrop" aria-label="Close filters" onClick={onCloseFiltersPanel} />}
        <aside ref={panelRef} className={`panel filters-panel ${filtersPanelOpen ? 'is-open' : ''}`}>
          <div className="filter-mobile-head">
            <button className="mobile-hide-filters-btn" type="button" onClick={onCloseFiltersPanel}>
              Hide Filters
            </button>
            <div className="mobile-head-actions">
              <button className="mobile-clear-btn" type="button" onClick={handleClearFilters}>
                Clear
              </button>
              <button className="mobile-close-btn" type="button" onClick={onCloseFiltersPanel}>
                Close
              </button>
            </div>
          </div>
          <div className="filter-head">
            <h2>Filters</h2>
            <button className="ghost-btn" type="button" onClick={handleClearFilters}>
              Clear Filters
            </button>
          </div>
          <p className="filter-note">Search and pick multiple RSM, ASM, or SO values.</p>

          <div className="filters">
            <div className="field">
              <label htmlFor="monthRangeFilter">Quick Range</label>
              <select
                id="monthRangeFilter"
                className="filter-search"
                value={filters.monthRange}
                onChange={(e) => onFilterChange('monthRange', e.target.value)}
              >
                <option value="">All Months</option>
                <option value="last_3">Last 3 Months</option>
                <option value="last_6">Last 6 Months</option>
                <option value="last_12">Last 12 Months</option>
              </select>
            </div>

            <div className="dropdown-stack">
              {filterSpecs.map((spec) => (
                <MultiSelectDropdown
                  key={spec.key}
                  label={spec.label}
                  placeholder={spec.placeholder}
                  options={spec.options}
                  selected={spec.selected}
                  searchTerm={searchTerms[spec.key]}
                  isOpen={openGroup === spec.key}
                  onToggleOpen={() => openDropdown(spec.key)}
                  onSearchChange={(value) => setSearchTerms((current) => ({ ...current, [spec.key]: value }))}
                  onToggle={(value) => onFilterChange(spec.key, toggleValue(spec.selected, value))}
                  onSelectAll={(items) => onFilterChange(spec.key, getAllOptions(items))}
                  onClearAll={() => onFilterChange(spec.key, [])}
                />
              ))}
            </div>
          </div>

          {status ? (
            <p className="status" data-error={statusError ? 'true' : 'false'}>
              {status}
            </p>
          ) : null}
        </aside>

        <section className="charts">
          {chartCards.map((card) => {
            const chart = charts[card.key] || { labels: [], values: [] };
            return (
              <article key={card.id} className="panel chart-card">
                <h3>{card.title}</h3>
                <TrendChartCard
                  title={card.title}
                  color={card.color}
                  isPercent={card.isPercent}
                  noDecimals={card.noDecimals || false}
                  labels={chart.labels}
                  values={chart.values}
                />
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  searchTerm,
  isOpen,
  onToggleOpen,
  onSearchChange,
  onToggle,
  onSelectAll,
  onClearAll
}) {
  const normalizedOptions = useMemo(() => {
    const values = [...new Set([...options, ...selected].filter(Boolean))];
    return values.sort((a, b) => String(a).localeCompare(String(b)));
  }, [options, selected]);

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((option) => option.toLowerCase().includes(query));
  }, [normalizedOptions, searchTerm]);

  const summary = selected.length === 0 ? 'All' : `${selected.length} selected`;

  return (
    <section className="multi-select-dropdown-wrap">
      <button type="button" className="multi-select-trigger" onClick={onToggleOpen}>
        <span className="multi-select-trigger-label">
          <span className="multi-select-trigger-title">{label}</span>
          <span className="multi-select-trigger-summary">{summary}</span>
        </span>
        <span className="multi-select-trigger-caret">{isOpen ? '^' : 'v'}</span>
      </button>
      {isOpen && (
        <div className="multi-select-dropdown">
          <div className="multi-select-dropdown-actions">
            <button type="button" className="multi-select-group-action" onClick={() => onSelectAll(filteredOptions)}>
              Select all search results
            </button>
            <button type="button" className="multi-select-group-action" onClick={onClearAll}>
              Clear all
            </button>
          </div>
          <div className="multi-select-dropdown-note">Add current selection to filter</div>
          <input
            className="filter-search"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            autoFocus
          />
          <div className="multi-select-options">
            {filteredOptions.length === 0 ? (
              <div className="multi-select-empty">No matches</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className={`multi-select-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onToggle(option)}
                  >
                    <span>{option}</span>
                    <span className="multi-select-check">{isSelected ? 'x' : ''}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="multi-select-dropdown-footer">
            <span className="multi-select-dropdown-note">Changes apply instantly</span>
          </div>
        </div>
      )}
    </section>
  );
}

function toggleValue(values, value) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}

function getAllOptions(options) {
  return [...new Set([...options].filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

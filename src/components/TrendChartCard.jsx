import { useEffect, useId, useMemo, useState } from 'react';

function formatTick(value, noDecimals = false) {
  return Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: noDecimals ? 0 : 2,
    minimumFractionDigits: 0
  });
}

export default function TrendChartCard({ title, color, isPercent, noDecimals, labels, values }) {
  const uid = useId();
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 640px)');
    const onChange = (event) => setIsCompact(event.matches);
    setIsCompact(media.matches);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const chart = useMemo(() => {
    const isSinglePoint = labels.length === 1;
    const renderLabels = isSinglePoint ? [labels[0], `${labels[0]} `] : labels;
    const renderValues = isSinglePoint ? [values[0], values[0]] : values;

    const finiteValues = renderValues.filter((v) => Number.isFinite(v));
    const minVal = finiteValues.length ? Math.min(...finiteValues) : 0;
    const maxVal = finiteValues.length ? Math.max(...finiteValues) : 0;
    const range = Math.max(maxVal - minVal, 1);
    const mid = (maxVal + minVal) / 2;
    const padRatio = isCompact ? 0.2 : isPercent ? 0.18 : range < 10 ? 0.22 : 0.16;
    const pad = Math.max(range * padRatio, Math.abs(mid) * 0.06, isPercent ? 0.25 : 1);
    const yMin = minVal - pad;
    const yMax = maxVal + pad;

    const width = 1000;
    const height = isCompact ? 260 : 340;
    const leftPad = isCompact ? 72 : 84;
    const rightPad = isCompact ? 36 : 24;
    const topPad = isCompact ? 14 : 30;
    const bottomPad = isCompact ? 70 : 66;
    const plotWidth = width - leftPad - rightPad;
    const plotHeight = height - topPad - bottomPad;

    const yTickCount = isCompact ? 4 : 5;
    const yTicks = Array.from({ length: yTickCount }, (_, index) => {
      const ratio = index / (yTickCount - 1);
      const value = yMax - (yMax - yMin) * ratio;
      const y = topPad + plotHeight * ratio;
      return { value, y };
    });

    const points = renderValues.map((value, index) => {
      const x =
        renderLabels.length === 1
          ? leftPad + plotWidth / 2
          : leftPad + (plotWidth * index) / Math.max(renderLabels.length - 1, 1);
      const ratio = yMax === yMin ? 0.5 : (value - yMin) / (yMax - yMin);
      const y = topPad + (1 - Math.min(Math.max(ratio, 0), 1)) * plotHeight;
      return { x, y, value, label: renderLabels[index] };
    });

    if (!points.length) {
      return {
        points: [],
        path: '',
        areaPath: '',
        areaBaseline: topPad + plotHeight,
        yTicks,
        isCompact,
        width,
        height,
        leftPad,
        rightPad,
        topPad,
        bottomPad
      };
    }

    const path = buildMonotonePath(points);
    const areaBaseline = topPad + plotHeight;
    const areaPath = `${path} L ${points[points.length - 1].x.toFixed(2)} ${areaBaseline.toFixed(2)} L ${points[0].x.toFixed(2)} ${areaBaseline.toFixed(2)} Z`;

    return {
      points,
      path,
      areaPath,
      areaBaseline,
      yTicks,
      isCompact,
      width,
      height,
      leftPad,
      rightPad,
      topPad,
      bottomPad
    };
  }, [isCompact, isPercent, labels, values]);

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        preserveAspectRatio="none"
        className="trend-chart-svg"
        role="img"
        aria-label={title}
        style={{
          width: '100%',
          height: `${chart.height}px`
        }}
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <g className="trend-grid">
          {chart.yTicks.map((tick, index) => (
            <g key={`grid-y-${index}`}>
              <line x1={chart.leftPad - 10} y1={tick.y} x2={chart.width - chart.rightPad} y2={tick.y} />
              <text x={chart.leftPad - 14} y={tick.y + 5} textAnchor="end" className="trend-axis-label">
                {isPercent ? `${formatTick(tick.value, false)}%` : formatTick(tick.value, noDecimals)}
              </text>
            </g>
          ))}
        </g>

        {chart.points.length > 0 ? (
          <>
            <path d={chart.areaPath} fill={`url(#fill-${uid})`} stroke="none" />
            <path d={chart.path} fill="none" stroke={color} strokeWidth={chart.isCompact ? '4' : '4.5'} strokeLinecap="round" strokeLinejoin="round" />

            {chart.points.map((point, index) => (
              <g key={`${title}-${index}`}>
                <circle cx={point.x} cy={point.y} r={chart.isCompact ? '7' : '8'} fill="#fff" stroke={color} strokeWidth={chart.isCompact ? '3.5' : '4'} />
                <text
                  x={resolveValueLabelX(point.x, index, chart.points.length)}
                  y={resolveValueLabelY(point.y, index, chart.points.length, chart.isCompact)}
                  textAnchor="middle"
                  className={`trend-point-label ${chart.isCompact ? 'is-compact' : ''}`}
                >
                  {isPercent ? `${formatTick(point.value, false)}%` : formatTick(point.value, noDecimals)}
                </text>
              </g>
            ))}

            {chart.points.map((point, index) => (
              <text
                key={`${title}-label-${index}`}
                x={resolveMonthLabelX(point.x, index, chart.points.length)}
                y={chart.isCompact ? chart.height - 16 : 312}
                textAnchor="middle"
                className="trend-x-label"
                transform={`rotate(${chart.isCompact ? 0 : -32} ${resolveMonthLabelX(point.x, index, chart.points.length)} ${chart.isCompact ? chart.height - 16 : 312})`}
              >
                {point.label}
              </text>
            ))}
          </>
        ) : (
          <text x="500" y="170" textAnchor="middle" className="trend-empty">
            Loading chart data...
          </text>
        )}
      </svg>
      {chart.isCompact && labels.length > 6 && (
        <div className="trend-chart-indicator" aria-hidden="true">
          <span className="trend-chart-indicator-line">
            <span className="trend-chart-indicator-thumb" />
          </span>
          <span className="trend-chart-indicator-text">Swipe to see all months</span>
        </div>
      )}
    </div>
  );
}

function resolveValueLabelY(pointY, index, totalPoints, isCompact) {
  const topBoundary = isCompact ? 22 : 28;
  const bottomBoundary = isCompact ? 256 : 264;
  const above = pointY - (isCompact ? 14 : 12);
  const below = pointY + (isCompact ? 18 : 20);
  const staggered = index % 2 === 0 ? above : below;
  const secondary = index % 2 === 0 ? below : above;

  if (staggered >= topBoundary && staggered <= bottomBoundary) return staggered;
  if (secondary >= topBoundary && secondary <= bottomBoundary) return secondary;
  if (index === 0) return Math.max(topBoundary, above);
  if (index === totalPoints - 1) return Math.min(bottomBoundary, Math.max(topBoundary, above));
  return Math.min(bottomBoundary, Math.max(topBoundary, above));
}

function resolveValueLabelX(pointX, index, totalPoints) {
  if (index === 0) return pointX + 6;
  if (index === totalPoints - 1) return pointX - 6;
  return pointX;
}

function resolveMonthLabelX(pointX, index, totalPoints) {
  if (index === 0) return pointX + 6;
  if (index === totalPoints - 1) return pointX - 8;
  return pointX;
}

function buildMonotonePath(points) {
  if (!points.length) return '';
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  const tangents = new Array(points.length).fill(0);
  const slopes = new Array(points.length - 1).fill(0);

  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x || 1;
    slopes[i] = (points[i + 1].y - points[i].y) / dx;
  }

  tangents[0] = slopes[0];
  tangents[points.length - 1] = slopes[slopes.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  for (let i = 0; i < slopes.length; i += 1) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    }
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const dx = next.x - current.x;
    const cp1x = current.x + dx / 3;
    const cp1y = current.y + (tangents[i] * dx) / 3;
    const cp2x = next.x - dx / 3;
    const cp2y = next.y - (tangents[i + 1] * dx) / 3;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

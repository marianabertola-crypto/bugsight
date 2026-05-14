import { useState, useMemo, useEffect, useRef } from 'react';
import { MODULE_NAMES } from '../config/modules';
import { fetchClosedBugs } from '../utils/jira';
import './Insights.css';

// ── Date helpers ──────────────────────────────────────────────────────────────

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateRange(from, to) {
  const dates = [];
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur <= end) {
    dates.push(dateToISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function daysBetween(from, to) {
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function shortDate(iso) {
  const [, m, d] = iso.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

function resolvePeriod(preset, from, to) {
  const t = today();
  if (preset === 'custom') return { from: from || '2025-04-01', to: to || t };
  if (preset === 'today') return { from: t, to: t };
  if (preset === '7d') return { from: daysAgo(7), to: t };
  if (preset === '30d') return { from: daysAgo(30), to: t };
  if (preset === 'thisMonth') return { from: firstOfMonth(), to: t };
  return { from: daysAgo(30), to: t };
}

function exportCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Line chart ────────────────────────────────────────────────────────────────

function LineChart({ series, labels, height = 180 }) {
  const [hover, setHover] = useState(null);
  const W = 560, H = height;
  const pad = { top: 15, right: 20, bottom: 40, left: 50 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;
  const allVals = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allVals, 1);
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));
  const xOf = (i) => pad.left + (i / Math.max(labels.length - 1, 1)) * iW;
  const yOf = (v) => pad.top + iH - (v / maxVal) * iH;
  const tooltipX = hover !== null ? xOf(hover) : 0;
  const flipTooltip = tooltipX > W * 0.65;
  const tooltipW = series.length > 1 ? 110 : 80;
  const tooltipH = series.length * 16 + 24;

  function onMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.round(((e.clientX - rect.left) / rect.width * W - pad.left) / iW * (labels.length - 1));
    setHover(idx >= 0 && idx < labels.length ? idx : null);
  }

  return (
    <div>
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginBottom: 6 }}>
          {series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#303036' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {gridLines.map((v, i) => (
          <g key={i}>
            <line x1={pad.left} y1={yOf(v)} x2={W - pad.right} y2={yOf(v)} stroke="#E5E7EB" strokeDasharray="4,4" />
            <text x={pad.left - 8} y={yOf(v) + 4} textAnchor="end" fontSize="11" fill="#636271">{v}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={xOf(i)} y={H - 5} textAnchor="middle" fontSize="10" fill="#636271" transform={`rotate(-30, ${xOf(i)}, ${H - 5})`}>{l}</text>
        ))}
        {series.map((s, si) => (
          <g key={si}>
            <polyline
              points={s.data.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            />
            {s.data.map((v, i) => (
              <circle key={i} cx={xOf(i)} cy={yOf(v)} r="3.5" fill="white" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={tooltipX} y1={pad.top} x2={tooltipX} y2={pad.top + iH} stroke="#636271" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            {series.map((s, i) => (
              <circle key={i} cx={tooltipX} cy={yOf(s.data[hover])} r="5" fill={s.color} stroke="white" strokeWidth="2" />
            ))}
            <rect x={flipTooltip ? tooltipX - tooltipW - 10 : tooltipX + 10} y={pad.top + 4} width={tooltipW} height={tooltipH} rx="4" fill="#1e2a3a" opacity="0.92" />
            <text x={flipTooltip ? tooltipX - tooltipW - 2 : tooltipX + 18} y={pad.top + 17} fontSize="10" fill="#aab4c0" fontWeight="600">{labels[hover]}</text>
            {series.map((s, i) => (
              <text key={i} x={flipTooltip ? tooltipX - tooltipW - 2 : tooltipX + 18} y={pad.top + 17 + (i + 1) * 16} fontSize="11" fill={s.color} fontWeight="600">
                {series.length > 1 ? `${s.label}: ` : ''}{s.data[hover]}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────

function HBarChart({ data, color, unit = '' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="hbar-chart">
      {data.map((row, i) => (
        <div key={i} className="hbar-row">
          <div className="hbar-label" title={row.label}>
            {row.href
              ? <a href={row.href} target="_blank" rel="noopener noreferrer" className="hbar-label-main hbar-label-link">{row.label}</a>
              : <span className="hbar-label-main">{row.label}</span>
            }
            {row.sublabel && <span className="hbar-label-sub">{row.sublabel}</span>}
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(row.value / max) * 100}%`, background: color }} />
          </div>
          <span className="hbar-value">{row.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

// ── Drilldown modal ───────────────────────────────────────────────────────────

function DrilldownModal({ title, bugs, onClose }) {
  return (
    <div className="drilldown-overlay" onClick={onClose}>
      <div className="drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drilldown-header">
          <h3 className="drilldown-title">{title}</h3>
          <button className="drilldown-close" onClick={onClose}>×</button>
        </div>
        <div className="drilldown-list">
          {bugs.map((bug) => (
            <a key={bug.id} className="drilldown-item" href={`https://humand.atlassian.net/browse/${bug.id}`} target="_blank" rel="noopener noreferrer">
              <div className="drilldown-item-top">
                <span className="drilldown-item-id">{bug.id}</span>
                <span className="drilldown-item-date">{bug.reportedAt}</span>
              </div>
              <div className="drilldown-item-title">{bug.title}</div>
              <div className="drilldown-item-meta">
                <span className="drilldown-item-module">{bug.module}</span>
                {(bug.affectedClients || []).length > 0 && (
                  <span className="drilldown-item-clients">{bug.affectedClients.length} clientes afectados</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Live incident cards ───────────────────────────────────────────────────────

function LiveCard({ type, activeBugs, allBugs }) {
  const [drilldown, setDrilldown] = useState(null);
  const isDowntime = type === 'downtime';
  const keyword = isDowntime ? 'downtime' : 'latencia';
  const keyword2 = isDowntime ? null : 'latency';
  const label = isDowntime ? 'Downtime' : 'Latencias';
  const color = isDowntime ? '#E24B4A' : '#4B6BFB';
  const glowClass = isDowntime ? 'live-card--glow-red' : 'live-card--glow-blue';

  const todayBugs = useMemo(() => {
    const t = today();
    return activeBugs.filter((b) => {
      if (b.reportedAt !== t) return false;
      const title = b.title.toLowerCase();
      return title.includes(keyword) || (keyword2 && title.includes(keyword2));
    });
  }, [activeBugs, keyword, keyword2]);

  const recentBugs = useMemo(() => {
    const cutoff = daysAgo(2);
    return allBugs.filter((b) => {
      const title = b.title.toLowerCase();
      return b.reportedAt >= cutoff && (title.includes(keyword) || (keyword2 && title.includes(keyword2)));
    });
  }, [allBugs, keyword, keyword2]);

  const isActive = todayBugs.length > 0;
  const displayBugs = isActive ? todayBugs : recentBugs;
  const cardTitle = isActive ? `${label} activo ahora — bugs abiertos` : `${label} — últimas 48hs`;

  return (
    <>
      <div
        className={`live-card${isActive ? ` live-card--active ${glowClass}` : ' live-card--quiet'}`}
        style={{ borderLeftColor: color }}
        onClick={() => displayBugs.length > 0 && setDrilldown({ title: cardTitle, bugs: displayBugs })}
      >
        <div className="live-card-header">
          <div className="live-card-title-row">
            <span className="live-card-label">{label}</span>
            {isActive && (
              <span className="live-badge">
                <span className="live-badge-dot" style={{ background: color }} />
                ACTIVO
              </span>
            )}
          </div>
          {displayBugs.length > 0 && <span className="alert-card-chevron">›</span>}
        </div>
        <div className="live-card-body">
          {isActive ? (
            <>
              <span className="live-card-count" style={{ color }}>{todayBugs.length}</span>
              <span className="live-card-desc">{todayBugs.length === 1 ? 'incidente abierto ahora' : 'incidentes abiertos ahora'}</span>
            </>
          ) : (
            <span className="live-card-quiet-msg">Sin incidentes activos</span>
          )}
        </div>
        {recentBugs.length > 0 && !isActive && (
          <div className="live-card-footer">{recentBugs.length} en las últimas 48hs</div>
        )}
      </div>
      {drilldown && <DrilldownModal title={drilldown.title} bugs={drilldown.bugs} onClose={() => setDrilldown(null)} />}
    </>
  );
}

// ── Alert cards ───────────────────────────────────────────────────────────────

function AlertCards({ bugs }) {
  const [drilldown, setDrilldown] = useState(null);

  const { pico, picoBugs } = useMemo(() => {
    const cutoff = daysAgo(3);
    const recent = bugs.filter((b) => b.reportedAt >= cutoff);
    const counts = {};
    for (const b of recent) counts[b.module] = (counts[b.module] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < 5) return { pico: null, picoBugs: [] };
    return { pico: { module: top[0], count: top[1] }, picoBugs: recent.filter((b) => b.module === top[0]) };
  }, [bugs]);

  const { clientesAltos, clientesBugs } = useMemo(() => {
    const cutoff = daysAgo(1);
    const high = bugs.filter((b) => b.reportedAt >= cutoff && (b.affectedClients || []).length >= 3);
    return { clientesAltos: high.length > 0 ? high.length : null, clientesBugs: high };
  }, [bugs]);

  const alerts = [
    {
      key: 'pico',
      color: pico ? 'red' : 'muted',
      icon: '🔴',
      title: 'Módulo en alerta',
      description: 'Se activa cuando un módulo acumula 5 o más bugs en los últimos 3 días',
      message: pico ? `${pico.module}: ${pico.count} bugs en 3 días` : 'Sin alertas activas',
      drillBugs: picoBugs,
      drillTitle: pico ? `Módulo en alerta — ${pico.module}` : '',
    },
    {
      key: 'clientes',
      color: clientesAltos ? 'yellow' : 'muted',
      icon: '🟡',
      title: 'Impacto en clientes',
      description: 'Cards con 3 o más clientes afectados reportadas en las últimas 24hs',
      message: clientesAltos ? `${clientesAltos} ${clientesAltos === 1 ? 'card' : 'cards'} con 3+ clientes en las últimas 24hs` : 'Sin alertas activas',
      drillBugs: clientesBugs,
      drillTitle: 'Impacto en clientes — últimas 24hs',
    },
  ];

  return (
    <>
      <div className="insights-alerts insights-alerts--2col">
        {alerts.map((a) => {
          const clickable = a.drillBugs.length > 0;
          return (
            <div
              key={a.key}
              className={`alert-card alert-card--${a.color}${clickable ? ' alert-card--clickable' : ''}`}
              onClick={() => clickable && setDrilldown({ title: a.drillTitle, bugs: a.drillBugs })}
            >
              <div className="alert-card-header">
                <span className="alert-card-icon">{a.icon}</span>
                <span className="alert-card-title">{a.title}</span>
                {clickable && <span className="alert-card-chevron">›</span>}
              </div>
              <p className="alert-card-description">{a.description}</p>
              <p className="alert-card-message">{a.message}</p>
            </div>
          );
        })}
      </div>
      {drilldown && <DrilldownModal title={drilldown.title} bugs={drilldown.bugs} onClose={() => setDrilldown(null)} />}
    </>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function BugsByDay({ bugs, period }) {
  const { labels, series } = useMemo(() => {
    const dates = dateRange(period.from, period.to);
    const counts = Object.fromEntries(dates.map((d) => [d, 0]));
    for (const b of bugs) if (counts[b.reportedAt] !== undefined) counts[b.reportedAt]++;
    return { labels: dates.map(shortDate), series: [{ data: dates.map((d) => counts[d]), color: '#4B6BFB', label: 'Bugs' }] };
  }, [bugs, period]);

  function download() {
    const rows = [['fecha', 'card_id', 'titulo', 'modulo', 'estado', 'prioridad'],
      ...bugs.sort((a, b) => a.reportedAt.localeCompare(b.reportedAt)).map((b) => [b.reportedAt, b.id, b.title, b.module, b.status, b.priority || ''])];
    exportCsv('bugs-por-dia.csv', rows);
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">Bugs por día</span>
        <button className="chart-csv-btn" onClick={download} title="Descargar CSV">↓</button>
      </div>
      {series[0].data.some((v) => v > 0)
        ? <LineChart series={series} labels={labels} />
        : <div className="chart-empty">Sin datos para el período seleccionado</div>}
    </div>
  );
}

function DowntimeLatencias({ allBugs, period }) {
  const { labels, series } = useMemo(() => {
    const dates = dateRange(period.from, period.to);
    const down = Object.fromEntries(dates.map((d) => [d, 0]));
    const lat = Object.fromEntries(dates.map((d) => [d, 0]));
    for (const b of allBugs) {
      if (b.reportedAt < period.from || b.reportedAt > period.to) continue;
      const title = b.title.toLowerCase();
      if (title.includes('downtime')) down[b.reportedAt]++;
      if (title.includes('latencia') || title.includes('latency')) lat[b.reportedAt]++;
    }
    return {
      labels: dates.map(shortDate),
      series: [
        { data: dates.map((d) => down[d]), color: '#E24B4A', label: 'Downtime' },
        { data: dates.map((d) => lat[d]), color: '#EF9F27', label: 'Latencias' },
      ],
    };
  }, [allBugs, period]);

  function download() {
    const relevant = allBugs.filter((b) => {
      if (b.reportedAt < period.from || b.reportedAt > period.to) return false;
      const t = b.title.toLowerCase();
      return t.includes('downtime') || t.includes('latencia') || t.includes('latency');
    }).sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
    const rows = [['fecha', 'tipo', 'card_id', 'titulo', 'estado'],
      ...relevant.map((b) => [b.reportedAt, b.title.toLowerCase().includes('downtime') ? 'Downtime' : 'Latencia', b.id, b.title, b.status])];
    exportCsv('downtime-latencias.csv', rows);
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">Downtime y Latencias por día</span>
        <button className="chart-csv-btn" onClick={download} title="Descargar CSV">↓</button>
      </div>
      {series.some((s) => s.data.some((v) => v > 0))
        ? <LineChart series={series} labels={labels} height={200} />
        : <div className="chart-empty">Sin datos para el período seleccionado</div>}
    </div>
  );
}

function TopClientes({ bugs }) {
  const [top, setTop] = useState(5);
  const data = useMemo(() =>
    [...bugs].filter((b) => (b.affectedClients || []).length > 0)
      .sort((a, b) => b.affectedClients.length - a.affectedClients.length)
      .slice(0, top)
      .map((b) => ({
        label: b.id,
        sublabel: b.title.length > 40 ? b.title.slice(0, 40) + '…' : b.title,
        value: b.affectedClients.length,
        href: `https://humand.atlassian.net/browse/${b.id}`,
      })),
    [bugs, top]);

  function download() {
    const rows = [['card_id', 'titulo', 'modulo', 'cliente_afectado']];
    for (const b of [...bugs].filter((b) => (b.affectedClients || []).length > 0).sort((a, b) => b.affectedClients.length - a.affectedClients.length).slice(0, top))
      for (const c of b.affectedClients || []) rows.push([b.id, b.title, b.module, c]);
    exportCsv('top-clientes.csv', rows);
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">Cards con más clientes afectados</span>
        <div className="chart-card-controls">
          {[[5, 'Top 5'], [10, 'Top 10']].map(([n, label]) => (
            <button key={n} className={`chart-pill${top === n ? ' active' : ''}`} onClick={() => setTop(n)}>{label}</button>
          ))}
          <button className="chart-csv-btn" onClick={download} title="Descargar CSV">↓</button>
        </div>
      </div>
      {data.length > 0
        ? <HBarChart data={data} color="#4B6BFB" />
        : <div className="chart-empty">Sin datos</div>}
    </div>
  );
}

function ClientesPorModulo({ bugs, period }) {
  const data = useMemo(() => {
    const counts = {};
    for (const b of bugs) {
      const m = b.module || 'General';
      counts[m] = (counts[m] || 0) + (b.affectedClients || []).length;
    }
    return Object.entries(counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [bugs]);

  function download() {
    const rows = [['modulo', 'cliente_afectado', 'card_id', 'titulo']];
    for (const b of bugs.filter((b) => (b.affectedClients || []).length > 0).sort((a, b) => a.module.localeCompare(b.module)))
      for (const c of b.affectedClients || []) rows.push([b.module || 'General', c, b.id, b.title]);
    exportCsv('clientes-por-modulo.csv', rows);
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">Clientes afectados por módulo</span>
        <button className="chart-csv-btn" onClick={download} title="Descargar CSV">↓</button>
      </div>
      {data.length > 0
        ? <HBarChart data={data} color="#1D9E75" />
        : <div className="chart-empty">Sin datos para el período seleccionado</div>}
    </div>
  );
}

function RankingModulos({ bugs }) {
  const data = useMemo(() => {
    const counts = {};
    for (const b of bugs) {
      const m = b.module || 'General';
      counts[m] = (counts[m] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [bugs]);

  function download() {
    const rows = [['modulo', 'card_id', 'titulo', 'fecha_reporte', 'estado'],
      ...bugs.sort((a, b) => a.module.localeCompare(b.module) || a.reportedAt.localeCompare(b.reportedAt))
        .map((b) => [b.module || 'General', b.id, b.title, b.reportedAt, b.status])];
    exportCsv('ranking-modulos.csv', rows);
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">Ranking de módulos — bugs reportados</span>
        <button className="chart-csv-btn" onClick={download} title="Descargar CSV">↓</button>
      </div>
      {data.length > 0
        ? <HBarChart data={data} color="#7F77DD" />
        : <div className="chart-empty">Sin datos para el período seleccionado</div>}
    </div>
  );
}

function VidaUtilPorModulo({ bugs, period }) {
  const data = useMemo(() => {
    const closed = bugs.filter((b) => b.resolvedAt && b.reportedAt >= period.from && b.reportedAt <= period.to);
    const acc = {};
    for (const b of closed) {
      const m = b.module || 'General';
      if (!acc[m]) acc[m] = { total: 0, count: 0 };
      acc[m].total += daysBetween(b.reportedAt, b.resolvedAt);
      acc[m].count++;
    }
    return Object.entries(acc)
      .map(([label, { total, count }]) => ({ label, value: Math.round(total / count), count }))
      .sort((a, b) => b.value - a.value);
  }, [bugs, period]);

  function download() {
    const rows = [['modulo', 'promedio_dias', 'cantidad_cards'], ...data.map((d) => [d.label, d.value, d.count])];
    exportCsv('vida-util-por-modulo.csv', rows);
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">Vida útil promedio por módulo</span>
        <div className="chart-card-controls">
          <span className="chart-card-subtitle">días desde reporte hasta cierre</span>
          <button className="chart-csv-btn" onClick={download} title="Descargar CSV">↓</button>
        </div>
      </div>
      {data.length > 0
        ? <HBarChart data={data} color="#F59E0B" unit="d" />
        : <div className="chart-empty">Sin datos de bugs cerrados para el período</div>}
    </div>
  );
}

// ── Closed bugs cache ─────────────────────────────────────────────────────────

const CACHE_KEY = 'bugsight_insights_closed_v2';
const CACHE_TTL = 10 * 60 * 1000;

async function loadClosedBugs() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch {}
  const data = await fetchClosedBugs();
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
  return data;
}

// ── Main Insights page ────────────────────────────────────────────────────────

const MIN_DATE = '2025-04-01';

export default function Insights({ bugs, onRefresh, refreshing }) {
  const [clientSearch, setClientSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [closedBugs, setClosedBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const allBugs = useMemo(() => [...bugs, ...closedBugs], [bugs, closedBugs]);

  async function fetchClosed(forceRefresh = false) {
    if (forceRefresh) {
      try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    }
    setLoading(true);
    try {
      const data = await loadClosedBugs();
      setClosedBugs(data);
    } catch (err) {
      console.error('Error cargando Insights:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchClosed(); }, []);

  function handleRefresh() {
    fetchClosed(true);
    onRefresh?.();
  }

  const allClients = useMemo(() => {
    const set = new Set();
    bugs.forEach((b) => (b.affectedClients || []).forEach((c) => { if (c) set.add(c); }));
    return [...set].sort();
  }, [bugs]);

  const suggestions = useMemo(() => {
    if (!clientSearch.trim()) return [];
    const q = clientSearch.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return allClients.filter((c) => norm(c).includes(q)).slice(0, 8);
  }, [allClients, clientSearch]);

  useEffect(() => {
    function onMouseDown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const period = useMemo(() => resolvePeriod(periodPreset, dateFrom, dateTo), [periodPreset, dateFrom, dateTo]);

  const filteredBugs = useMemo(() => {
    const norm = (s) => s?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() ?? '';
    let result = allBugs;
    if (clientSearch.trim()) {
      const q = norm(clientSearch.trim());
      result = result.filter((b) => (b.affectedClients || []).some((c) => norm(c).includes(q)));
    }
    if (moduleFilter && moduleFilter !== 'all') {
      result = result.filter((b) => b.miniApps?.includes(moduleFilter) || b.module === moduleFilter);
    }
    result = result.filter((b) => b.reportedAt >= period.from && b.reportedAt <= period.to);
    return result;
  }, [allBugs, clientSearch, moduleFilter, period]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Cargando Insights desde Jira…</p>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <div className="insights-header">
        <div>
          <h1 className="insights-title">Insights</h1>
          <p className="insights-subtitle">Análisis y tendencias de bugs por módulo y cliente</p>
        </div>
        <button
          className={`btn-refresh-inline ${refreshing || loading ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing || loading}
          title="Actualizar datos desde Jira"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      <div className="insights-content">
        {/* Filters */}
        <div className="insights-filter-bar">
          <div className="insights-filter-group" ref={dropdownRef} style={{ position: 'relative' }}>
            <span className="insights-filter-label">Cliente</span>
            <div className="client-autocomplete">
              <input
                className="insights-filter-input"
                type="text"
                placeholder="Buscar cliente…"
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                autoComplete="off"
              />
              {clientSearch && (
                <button className="client-autocomplete-clear" onMouseDown={(e) => { e.preventDefault(); setClientSearch(''); setShowDropdown(false); }}>×</button>
              )}
              {showDropdown && suggestions.length > 0 && (
                <div className="client-autocomplete-dropdown">
                  {suggestions.map((s) => (
                    <button key={s} className="client-autocomplete-option" onMouseDown={(e) => { e.preventDefault(); setClientSearch(s); setShowDropdown(false); }}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="insights-filter-group">
            <span className="insights-filter-label">Módulo</span>
            <select className="insights-filter-select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="all">Todos los módulos</option>
              {MODULE_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="insights-filter-group insights-filter-group--period">
            <span className="insights-filter-label">Período</span>
            <div className="insights-filter-pills">
              {[['today', 'Hoy'], ['7d', '7 días'], ['30d', '30 días'], ['thisMonth', 'Este mes'], ['custom', 'Personalizado']].map(([v, l]) => (
                <button key={v} className={`insights-pill${periodPreset === v ? ' active' : ''}`} onClick={() => setPeriodPreset(v)}>{l}</button>
              ))}
            </div>
            {periodPreset === 'custom' && (
              <div className="insights-custom-range">
                <input type="date" className="insights-filter-input insights-date-input" value={dateFrom} min={MIN_DATE} max={dateTo || today()} onChange={(e) => setDateFrom(e.target.value)} />
                <span className="insights-date-sep">→</span>
                <input type="date" className="insights-filter-input insights-date-input" value={dateTo} min={dateFrom || MIN_DATE} max={today()} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Live cards */}
        <div className="insights-live-row">
          <LiveCard type="downtime" activeBugs={bugs} allBugs={allBugs} />
          <LiveCard type="latencia" activeBugs={bugs} allBugs={allBugs} />
        </div>

        {/* Alert cards */}
        <AlertCards bugs={allBugs} />

        {/* Charts */}
        <div className="insights-charts">
          <div className="insights-charts-row">
            <BugsByDay bugs={filteredBugs} period={period} />
            <DowntimeLatencias allBugs={allBugs} period={period} />
          </div>
          <TopClientes bugs={filteredBugs} />
          <div className="insights-charts-row">
            <ClientesPorModulo bugs={filteredBugs} period={period} />
            <RankingModulos bugs={filteredBugs} />
          </div>
          <VidaUtilPorModulo bugs={allBugs} period={period} />
        </div>
      </div>
    </div>
  );
}

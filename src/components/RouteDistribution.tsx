import React, { useMemo, useState } from 'react';
import { Lane, User } from '../types';

const ROUTES: { lane: Lane; label: string; color: string }[] = [
  { lane: 'TOP', label: 'Top', color: '#f43f5e' },
  { lane: 'JUNGLE', label: 'Jungler', color: '#10b981' },
  { lane: 'MID', label: 'Mid', color: '#f59e0b' },
  { lane: 'ADC', label: 'ADC', color: '#38bdf8' },
  { lane: 'SUPORTE', label: 'Suporte', color: '#a78bfa' },
  { lane: 'PREENCHER', label: 'Preencher', color: '#94a3b8' },
];

const pieSlicePath = (startAngle: number, endAngle: number, radius = 86) => {
  const center = 100;
  const toPoint = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return [center + radius * Math.cos(radians), center + radius * Math.sin(radians)];
  };
  const [startX, startY] = toPoint(startAngle);
  const [endX, endY] = toPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
};

export const RouteDistribution: React.FC<{ users: User[] }> = ({ users }) => {
  const [hoveredRoute, setHoveredRoute] = useState<Lane | null>(null);
  const routeCounts = useMemo(() => {
    const counts = Object.fromEntries(ROUTES.map(({ lane }) => [lane, 0])) as Record<Lane, number>;
    users.forEach((user) => {
      const lane = ROUTES.some((route) => route.lane === user.primaryLane) ? user.primaryLane : 'PREENCHER';
      counts[lane] += 1;
    });
    return counts;
  }, [users]);
  const routeSlices = useMemo(() => {
    const total = ROUTES.reduce((sum, route) => sum + routeCounts[route.lane], 0);
    let cursor = -90;
    return ROUTES.map((route) => {
      const startAngle = cursor;
      const endAngle = total ? cursor + (routeCounts[route.lane] / total) * 360 : cursor;
      cursor = endAngle;
      return { ...route, count: routeCounts[route.lane], startAngle, endAngle };
    }).filter((route) => route.count > 0);
  }, [routeCounts]);
  const focusedRoute = ROUTES.find((route) => route.lane === hoveredRoute);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Distribuição do elenco</p>
          <h2 className="mt-1 font-display text-xl font-black text-white">Rotas principais</h2>
          <p className="mt-1 text-xs text-slate-400">Cada pessoa entra em uma categoria, considerando apenas a rota principal do perfil.</p>
        </div>
        <span className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300">
          {users.length} {users.length === 1 ? 'jogador cadastrado' : 'jogadores cadastrados'}
        </span>
      </div>

      <div className="grid items-center gap-8 md:grid-cols-[minmax(220px,0.8fr)_minmax(280px,1.2fr)]">
        <div className="flex flex-col items-center">
          <div role="status" aria-live="polite" className="mb-3 flex min-h-10 w-full max-w-xs items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-center text-sm font-bold text-white">
            {focusedRoute
              ? `${focusedRoute.label}: ${routeCounts[focusedRoute.lane]} ${routeCounts[focusedRoute.lane] === 1 ? 'pessoa' : 'pessoas'}`
              : 'Passe o cursor sobre uma fatia'}
          </div>
          <svg viewBox="0 0 200 200" role="group" aria-label={`Gráfico de pizza com a distribuição das rotas principais entre ${users.length} jogadores`} className="h-64 w-64 max-w-full drop-shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
            {routeSlices.length === 0 ? (
              <circle cx="100" cy="100" r="86" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            ) : routeSlices.length === 1 ? (
              <circle
                cx="100" cy="100" r="86" fill={routeSlices[0].color} stroke="#020617" strokeWidth="2"
                onMouseEnter={() => setHoveredRoute(routeSlices[0].lane)}
                onMouseLeave={() => setHoveredRoute(null)}
                onFocus={() => setHoveredRoute(routeSlices[0].lane)}
                onBlur={() => setHoveredRoute(null)}
                tabIndex={0}
                aria-label={`${routeSlices[0].label}: ${routeSlices[0].count} ${routeSlices[0].count === 1 ? 'pessoa' : 'pessoas'}`}
              />
            ) : routeSlices.map((route) => (
              <path
                key={route.lane}
                d={pieSlicePath(route.startAngle, route.endAngle)}
                fill={route.color}
                stroke="#020617"
                strokeWidth="2"
                className="cursor-pointer transition-opacity hover:brightness-125 focus:brightness-125"
                onMouseEnter={() => setHoveredRoute(route.lane)}
                onMouseLeave={() => setHoveredRoute(null)}
                onFocus={() => setHoveredRoute(route.lane)}
                onBlur={() => setHoveredRoute(null)}
                tabIndex={0}
                aria-label={`${route.label}: ${route.count} ${route.count === 1 ? 'pessoa' : 'pessoas'}`}
              >
                <title>{`${route.label}: ${route.count} ${route.count === 1 ? 'pessoa' : 'pessoas'}`}</title>
              </path>
            ))}
          </svg>
          {users.length === 0 && <p className="-mt-2 text-xs text-slate-500">Ainda não há jogadores cadastrados.</p>}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {ROUTES.map((route) => (
            <button
              key={route.lane}
              type="button"
              onMouseEnter={() => setHoveredRoute(route.lane)}
              onMouseLeave={() => setHoveredRoute(null)}
              onFocus={() => setHoveredRoute(route.lane)}
              onBlur={() => setHoveredRoute(null)}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${hoveredRoute === route.lane ? 'border-slate-500 bg-slate-800' : 'border-slate-800 bg-slate-950/70 hover:bg-slate-900'}`}
            >
              <span className="flex items-center gap-3 text-sm font-semibold text-slate-200">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: route.color }} />
                {route.label}
              </span>
              <span className="font-mono text-lg font-black text-white">{routeCounts[route.lane]}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

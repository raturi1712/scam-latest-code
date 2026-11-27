"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEVEL_HEX } from "@/components/scan/RiskBadge";
import { RISK_LEVELS } from "@/lib/scoring/levels";

/* Chart chrome reads the theme tokens, so axes, grid lines and gaps follow light and dark mode. */
const SURFACE = "var(--ss-surface)";
const GRID = "var(--ss-line)";
const TICK = { fill: "var(--ss-muted)", fontSize: 12 };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((entry) => entry.value > 0);
  return (
    <div className="min-w-36 rounded-lg border border-line bg-surface-2 px-3 py-2.5 shadow-pop">
      {label ? <p className="mb-1.5 text-xs font-medium text-muted">{label}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-fg">No scans</p> : null}
      {rows.map((entry) => (
        <p key={entry.dataKey + entry.name} className="flex items-center justify-between gap-4 text-sm text-fg">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: entry.payload.fill || entry.fill }} aria-hidden="true" />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ className }) {
  return (
    <ul className={className} aria-hidden="true">
      {RISK_LEVELS.map((level) => (
        <li key={level.id} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="size-2 rounded-full" style={{ background: LEVEL_HEX[level.id] }} />
          {level.label}
        </li>
      ))}
    </ul>
  );
}

/** Scans per day for the last week, stacked by risk level. */
export function ActivityChart({ data }) {
  const total = data.reduce((sum, day) => sum + day.safe + day.low + day.suspicious + day.high, 0);
  return (
    <figure>
      <Legend className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5" />
      <div className="h-64" role="img" aria-label={`Bar chart of scans per day over the last 7 days. ${total} scans in total.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="32%">
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} dy={6} />
            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--ss-fg)", fillOpacity: 0.05, radius: 6 }} />
            {RISK_LEVELS.map((level) => (
              <Bar
                key={level.id}
                dataKey={level.id}
                name={level.label}
                stackId="scans"
                fill={LEVEL_HEX[level.id]}
                stroke={SURFACE}
                strokeWidth={2}
                radius={3}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Scans per day by risk level</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {RISK_LEVELS.map((level) => (
              <th key={level.id} scope="col">
                {level.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.key}>
              <th scope="row">{day.day}</th>
              {RISK_LEVELS.map((level) => (
                <td key={level.id}>{day[level.id]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** How all scans split across the four risk levels: donut with the total in the centre and a labelled breakdown. */
export function RiskBreakdownChart({ stats }) {
  const data = RISK_LEVELS.map((level) => ({
    id: level.id,
    name: level.label,
    count: stats[level.id],
    fill: LEVEL_HEX[level.id],
  }));
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <figure className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
      <div
        className="relative size-44 shrink-0"
        role="img"
        aria-label={`Donut chart of scans by risk level: ${data.map((item) => `${item.name} ${item.count}`).join(", ")}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? data : [{ name: "No scans", count: 1, fill: GRID }]}
              dataKey="count"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={total > 0 ? 2 : 0}
              cornerRadius={4}
              stroke={SURFACE}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {(total > 0 ? data : [{ fill: GRID }]).map((item, index) => (
                <Cell key={index} fill={item.fill} />
              ))}
            </Pie>
            {total > 0 ? <Tooltip content={<ChartTooltip />} /> : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums text-fg">{total}</span>
          <span className="text-xs text-muted">total scans</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {data.map((item) => {
          const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-fg">
                  <span className="size-2.5 rounded-full" style={{ background: item.fill }} aria-hidden="true" />
                  {item.name}
                </span>
                <span className="tabular-nums text-muted">
                  <span className="font-semibold text-fg">{item.count}</span> · {share}%
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${share}%`, background: item.fill }} />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

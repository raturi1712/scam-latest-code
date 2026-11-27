import { OctagonAlert, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { getLevel, RISK_LEVELS } from "@/lib/scoring/levels";
import { cn } from "@/lib/utils/cn";

export const LEVEL_ICONS = {
  safe: ShieldCheck,
  low: ShieldAlert,
  suspicious: TriangleAlert,
  high: OctagonAlert,
};

/**
 * UI colours per risk level, from styles/tokens.css. `solid` is for marks (gauge, bars, dots),
 * `fg` for text on the current surface, `soft` for tinted backgrounds.
 */
export const LEVEL_COLORS = {
  safe: { solid: "var(--ss-risk-safe)", fg: "var(--ss-risk-safe-fg)", soft: "var(--ss-risk-safe-soft)" },
  low: { solid: "var(--ss-risk-low)", fg: "var(--ss-risk-low-fg)", soft: "var(--ss-risk-low-soft)" },
  suspicious: { solid: "var(--ss-risk-suspicious)", fg: "var(--ss-risk-suspicious-fg)", soft: "var(--ss-risk-suspicious-soft)" },
  high: { solid: "var(--ss-risk-high)", fg: "var(--ss-risk-high-fg)", soft: "var(--ss-risk-high-soft)" },
};

/** Raw hex values for chart libraries that need literal colours. Same as the tokens above. */
export const LEVEL_HEX = { safe: "#34d399", low: "#fbbf24", suspicious: "#f97316", high: "#e11d48" };

/** Level badge. The label and icon carry the meaning; colour is reinforcement only. */
export function RiskBadge({ level, score, className, size = "md" }) {
  const info = getLevel(level);
  if (!info) return null;
  const Icon = LEVEL_ICONS[level];
  const color = LEVEL_COLORS[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-0.5 text-xs",
        className,
      )}
      style={{ background: color.soft, color: color.fg, "--tw-ring-color": `color-mix(in srgb, ${color.solid} 30%, transparent)` }}
    >
      <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
      {info.label}
      {typeof score === "number" ? (
        <span className="tabular-nums opacity-80" aria-label={`score ${score} out of 100`}>
          · {score}
        </span>
      ) : null}
    </span>
  );
}

/* ---------- Semi-circular risk gauge (the product's signature element) ---------- */

const GAUGE = { cx: 100, cy: 100, r: 80, stroke: 14 };

function polar(angleDeg, r = GAUGE.r) {
  const rad = (Math.PI / 180) * angleDeg;
  return { x: GAUGE.cx + r * Math.cos(rad), y: GAUGE.cy - r * Math.sin(rad) };
}

/** Arc from score a to score b (0..100 maps to 180°..0°). */
function arcPath(a, b, r = GAUGE.r) {
  const start = polar(180 - (a / 100) * 180, r);
  const end = polar(180 - (b / 100) * 180, r);
  const large = b - a > 100 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/**
 * Semi-circular 0-100 gauge. A neutral track with small ticks at the band thresholds; the filled
 * arc and needle mark the score. Label and level text sit in the centre so meaning never depends on colour.
 */
export function RiskGauge({ score, level, size = "md", className, showLabel = true }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const info = getLevel(level);
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.safe;
  const needle = polar(180 - (clamped / 100) * 180, GAUGE.r);
  const dims = { xs: "w-36", sm: "w-40", md: "w-56", lg: "w-64" }[size];
  const small = size === "xs" || size === "sm";

  return (
    <div className={cn("relative mx-auto", dims, className)} role="img" aria-label={`Risk score ${clamped} out of 100: ${info?.label}`}>
      <svg viewBox="0 0 200 116" className="w-full overflow-visible">
        {/* Neutral track */}
        <path d={arcPath(0, 100)} stroke="var(--ss-surface-2)" strokeWidth={GAUGE.stroke} strokeLinecap="round" fill="none" />
        {/* Band thresholds (15, 35, 65), drawn just outside the track */}
        {RISK_LEVELS.slice(1).map((band) => {
          const angle = 180 - (band.min / 100) * 180;
          const inner = polar(angle, GAUGE.r + GAUGE.stroke / 2 + 3);
          const outer = polar(angle, GAUGE.r + GAUGE.stroke / 2 + 8);
          return <line key={band.id} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--ss-subtle)" strokeWidth="1.5" strokeLinecap="round" />;
        })}
        {/* Score arc */}
        {clamped > 0 ? (
          <path d={arcPath(0, Math.max(clamped, 1))} stroke={color.solid} strokeWidth={GAUGE.stroke} strokeLinecap="round" fill="none" />
        ) : null}
        {/* Needle tip */}
        <circle cx={needle.x} cy={needle.y} r="9" fill="var(--ss-surface)" stroke={color.solid} strokeWidth="3.5" />
        {/* Scale labels (hidden on small gauges, where they would be unreadable) */}
        {small
          ? null
          : [0, 100].map((tick) => {
              const p = polar(180 - (tick / 100) * 180, GAUGE.r);
              return (
                <text key={tick} x={p.x} y={p.y + 16} textAnchor="middle" fontSize="10" fill="var(--ss-subtle)" fontWeight="500">
                  {tick}
                </text>
              );
            })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <p className={cn("font-semibold leading-none tracking-tight tabular-nums text-fg", small ? "text-[2rem]" : "text-[2.75rem]")}>
          {clamped}
        </p>
        {showLabel && info ? (
          <p className={cn("font-semibold", small ? "mt-1 text-xs" : "mt-1.5 text-sm")} style={{ color: color.fg }}>
            {info.label}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Segmented 0-100 scale showing the four bands and where a score falls. */
export function RiskScale({ score, className, showLabels = true }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className={className}>
      <div className="relative">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Risk score ${score} out of 100`}>
          {RISK_LEVELS.map((band) => (
            <div
              key={band.id}
              className="h-full"
              style={{ width: `${band.max - band.min + 1}%`, background: LEVEL_COLORS[band.id].solid, opacity: 0.85 }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-fg shadow-card"
          style={{ left: `${clamped}%` }}
          aria-hidden="true"
        />
      </div>
      {showLabels ? (
        <div className="mt-2 flex text-[0.6875rem] font-medium text-subtle" aria-hidden="true">
          {RISK_LEVELS.map((band) => (
            <span key={band.id} className="overflow-hidden whitespace-nowrap" style={{ width: `${band.max - band.min + 1}%` }}>
              {band.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex justify-between text-[0.6875rem] font-medium text-subtle" aria-hidden="true">
          <span>0</span>
          <span>100</span>
        </div>
      )}
    </div>
  );
}

export type DonutDatum = { label: string; value: number; color: string };

const PALETTE = ["#0d9488", "#06b6d4", "#f59e0b", "#8b5cf6", "#e11d48", "#0284c7", "#16a34a", "#94a3b8"];

function titleize(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DonutChart({ data, centerSubtitle = "Total" }: { data: DonutDatum[]; centerSubtitle?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 42;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const seg = { color: d.color, dash, offset };
    offset += fraction * circumference;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(s.dash - 1.2, 0.8)} ${circumference}`}
            strokeDashoffset={-s.offset}
          />
        ))}
        <text
          x="50"
          y="48"
          textAnchor="middle"
          className="fill-slate-900"
          style={{ fontSize: 11, fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 6 }}
        >
          {centerSubtitle}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 truncate text-slate-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate">{titleize(d.label)}</span>
            </span>
            <span className="font-semibold text-slate-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function makeDonutData(
  breakdown: Record<string, number>,
  palette: string[] = PALETTE,
): DonutDatum[] {
  return Object.entries(breakdown).map(([label, value], i) => ({
    label,
    value,
    color: palette[i % palette.length],
  }));
}

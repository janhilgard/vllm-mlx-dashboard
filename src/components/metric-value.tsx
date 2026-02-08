"use client";

interface MetricValueProps {
  label: string;
  value: string | number;
  suffix?: string;
  highlight?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(1);
}

export function MetricValue({ label, value, suffix, highlight }: MetricValueProps) {
  const displayValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`font-mono tabular-nums text-sm font-medium ${
          highlight ? "text-red-400" : ""
        }`}
      >
        {displayValue}
        {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}

export { formatNumber };

import type { ReactNode } from "react";
import { ArrowUpRightIcon, BoltIcon } from "@heroicons/react/24/outline";

export function number(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "—";
}
export function timestamp(value?: string) {
  if (!value) return "Timestamp unavailable";
  // Database timestamps are naive; keep their source wall time rather than inventing a timezone.
  return value.replace("T", " ").replace(/\.\d+$/, "");
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Panel({
  title,
  eyebrow,
  trailing,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  unit,
  caption,
  tone = "green",
  icon,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  caption: string;
  tone?: string;
  icon?: ReactNode;
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-label">
        <span>{label}</span>
        <span className="metric-icon">{icon || <BoltIcon />}</span>
      </div>
      <p className="metric-value">
        {number(value)}
        <span>{unit}</span>
      </p>
      <div className="metric-caption">
        <span className="tiny-dot" />
        {caption}
      </div>
    </article>
  );
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <BoltIcon />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ResourceFeedback({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string;
  data: unknown;
}) {
  return (
    <>
      {error && (
        <p className="notice notice-warning" role="alert">
          {error}
          {data ? " Showing the last received response." : ""}
        </p>
      )}
      {loading && !data && (
        <div className="skeleton" role="status" aria-label="Loading data" />
      )}
    </>
  );
}
export function DataList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="data-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRightIcon />
    </button>
  );
}

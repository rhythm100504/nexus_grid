import type { DecisionResult, Optimization } from "../types";
import { Badge, DataList, Empty, number } from "./ui";
import { CpuChipIcon } from "@heroicons/react/24/outline";

export function OptimizationOutput({ result }: { result?: Optimization }) {
  if (!result)
    return (
      <Empty title="No optimization result">
        Run the existing agent from Command Center to view its response.
      </Empty>
    );
  const fields: [string, keyof Optimization][] = [
    ["Solar generation", "solar_gen"],
    ["Wind generation", "wind_gen"],
    ["Grid import", "grid_import"],
    ["Grid export", "grid_export"],
    ["Battery charge", "battery_charge"],
    ["Battery discharge", "battery_discharge"],
    ["Solar curtailment", "solar_curtail"],
    ["Wind curtailment", "wind_curtail"],
  ];
  return (
    <>
      <div className="result-status">
        <Badge tone={result.status === "OPTIMAL" ? "green" : "amber"}>
          {result.status || "Status unavailable"}
        </Badge>
        <span className="muted">Backend solver result</span>
      </div>
      <DataList
        rows={fields.map(([label, key]) => [
          label,
          `${number(result[key] as number | undefined, 2)} MW`,
        ])}
      />
      <div className="objective">
        <span>Objective value</span>
        <strong>{number(result.objective_value, 2)}</strong>
      </div>
    </>
  );
}
export function DecisionOutput({
  result,
  compact = false,
}: {
  result: DecisionResult | null;
  compact?: boolean;
}) {
  if (!result)
    return (
      <Empty title="Ready to reason" icon={<CpuChipIcon />}>
        Run agentic optimization to receive a decision and explanation from the
        existing orchestration pipeline.
      </Empty>
    );
  return (
    <div className="decision-output" data-testid="decision-output">
      {result.error ? (
        <p className="notice notice-warning" role="alert">
          {result.error}
        </p>
      ) : (
        <>
          <div className="decision-action">
            <span className="eyebrow">Selected action</span>
            <strong>{result.decision?.action || "Action not provided"}</strong>
            <Badge tone="cyan">Simulation</Badge>
          </div>
          {result.message && <p className="notice">{result.message}</p>}
          <div className="reasoning">
            <span className="eyebrow">Agent explanation</span>
            <p>
              {result.explanation || "No explanation returned by the backend."}
            </p>
          </div>
          {!compact && (
            <>
              <p className="helper">
                Confidence, risk, rejected alternatives, and approval
                requirements are not supplied by this response.
              </p>
              <details className="details">
                <summary>Optimization breakdown</summary>
                <OptimizationOutput result={result.optimization} />
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}

import {
  SunIcon,
  CloudIcon,
  BoltIcon,
  Battery50Icon,
} from "@heroicons/react/24/outline";
import type { SystemState } from "../types";
import { number } from "./ui";

export function EnergyFlow({ state }: { state: SystemState | null }) {
  return (
    <div className="energy-flow">
      <div className="flow-sources">
        <div className="flow-node">
          <SunIcon className="color-amber" />
          <div>
            <span>Solar generation</span>
            <strong>
              {number(state?.solar_mw)} <small>MW</small>
            </strong>
          </div>
        </div>
        <div className="flow-node">
          <CloudIcon className="color-cyan" />
          <div>
            <span>Wind generation</span>
            <strong>
              {number(state?.wind_mw)} <small>MW</small>
            </strong>
          </div>
        </div>
      </div>
      <div className="flow-connections" aria-hidden="true">
        <svg viewBox="0 0 90 150" preserveAspectRatio="none">
          <defs>
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10" fill="#42d6a4" />
            </marker>
          </defs>
          <path d="M0 32H28Q40 32 40 48V102Q40 116 54 116H85" />
          <path d="M0 116H85" />
        </svg>
      </div>
      <div className="flow-center">
        <div className="flow-hub">
          <BoltIcon />
          <span>Renewable output</span>
          <strong>
            {state ? number(state.solar_mw + state.wind_mw) : "—"}{" "}
            <small>MW</small>
          </strong>
        </div>
        <div className="flow-storage">
          <Battery50Icon />
          <span>Battery SOC</span>
          <strong>{number(state?.battery_soc)}%</strong>
        </div>
      </div>
      <div className="flow-demand">
        <span className="eyebrow">Demand</span>
        <strong>
          {number(state?.demand_mw)} <small>MW</small>
        </strong>
        <span className="muted">Latest system snapshot</span>
      </div>
    </div>
  );
}

export interface SystemState {
  solar_mw: number;
  wind_mw: number;
  demand_mw: number;
  battery_soc: number;
  electricity_price: number;
}
export interface Asset {
  id: number;
  name: string;
  capacity_mw: number;
  location: string;
  status: string;
}
export interface Battery {
  id: number;
  name: string;
  capacity_mwh: number;
  current_soc: number;
  max_charge_rate_mw: number;
  max_discharge_rate_mw: number;
  charge_efficiency: number;
  degradation_factor: number;
  status: string;
}
export interface Assets {
  solar_farms: Asset[];
  wind_farms: Asset[];
  batteries: Battery[];
}
export interface GridRecord {
  id: number;
  timestamp: string;
  current_demand_mw: number;
  grid_frequency_hz: number;
  transmission_capacity_mw: number;
}
export interface MarketRecord {
  id: number;
  timestamp: string;
  electricity_price_mwh: number;
  carbon_price_ton: number;
  demand_response_incentive: number;
}
export interface Forecasts {
  solar_1hr: number;
  wind_1hr: number;
  demand_1hr: number;
}
export interface Optimization {
  status?: string;
  solar_gen?: number;
  wind_gen?: number;
  grid_import?: number;
  grid_export?: number;
  battery_charge?: number;
  battery_discharge?: number;
  solar_curtail?: number;
  wind_curtail?: number;
  objective_value?: number;
}
export interface DecisionResult {
  status?: string;
  scenario_id?: number;
  message?: string;
  error?: string;
  decision?: { action?: string; details?: Optimization };
  explanation?: string;
  optimization?: Optimization;
}
export interface AuditRecord {
  id: number;
  timestamp: string;
  event: string;
  details: {
    scenario_id?: number;
    decision?: DecisionResult["decision"];
    explanation?: string;
    optimization_result?: Optimization;
  };
}
export interface Weather {
  status: string;
  temperature_c: number;
  wind_speed_ms: number;
}
export interface Analytics {
  cost_savings: number;
  carbon_reduction_tons: number;
}

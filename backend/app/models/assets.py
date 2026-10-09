from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, DateTime
from .base import Base

class SolarFarm(Base):
    __tablename__ = "solar_farms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    capacity_mw = Column(Float)
    location = Column(String)
    status = Column(String) # active, maintenance, offline

class WindFarm(Base):
    __tablename__ = "wind_farms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    capacity_mw = Column(Float)
    location = Column(String)
    status = Column(String)

class Battery(Base):
    __tablename__ = "batteries"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    capacity_mwh = Column(Float)
    max_charge_rate_mw = Column(Float)
    max_discharge_rate_mw = Column(Float)
    charge_efficiency = Column(Float)
    current_soc = Column(Float) # State of Charge
    degradation_factor = Column(Float)
    status = Column(String)

class GridState(Base):
    __tablename__ = "grid_state"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True)
    current_demand_mw = Column(Float)
    grid_frequency_hz = Column(Float)
    transmission_capacity_mw = Column(Float)

class MarketPrice(Base):
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True)
    electricity_price_mwh = Column(Float)
    carbon_price_ton = Column(Float)
    demand_response_incentive = Column(Float)

class Decision(Base):
    __tablename__ = "decisions"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime)
    agent_name = Column(String)
    situation_summary = Column(String)
    selected_action = Column(String)
    reasoning = Column(String)
    expected_impact = Column(JSON)
    confidence = Column(Float)
    risk_level = Column(String) # low, medium, high
    approval_status = Column(String) # auto, pending, approved, rejected

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime)
    event = Column(String)
    details = Column(JSON)
class EnergyMeasurement(Base):
    __tablename__ = "energy_measurements"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, index=True)
    asset_type = Column(String)
    timestamp = Column(DateTime)
    output_mw = Column(Float)

class WeatherMeasurement(Base):
    __tablename__ = "weather_measurements"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime)
    temperature_c = Column(Float)
    wind_speed_ms = Column(Float)
    solar_irradiance = Column(Float)
    cloud_cover_pct = Column(Float)

class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime)
    target_time = Column(DateTime)
    metric_name = Column(String)
    predicted_value = Column(Float)
    confidence_interval = Column(Float)

class Constraint(Base):
    __tablename__ = "constraints"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    is_active = Column(Boolean)

class Action(Base):
    __tablename__ = "actions"
    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer)
    action_type = Column(String)
    target_asset = Column(String)
    value = Column(Float)
    status = Column(String)

class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime)
    scenario_id = Column(Integer)
    parameters = Column(JSON)

class SimulationResult(Base):
    __tablename__ = "simulation_results"
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer)
    expected_cost = Column(Float)
    expected_carbon = Column(Float)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime)
    severity = Column(String)
    message = Column(String)
    is_resolved = Column(Boolean)

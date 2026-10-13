"""Persistent simulation inputs shared by all dashboard endpoints."""
from ..models.assets import SimulationConfig, SolarFarm, WindFarm, Battery, GridState, MarketPrice

DEFAULTS = dict(solar_factor=0.7, wind_factor=0.6, weather_status="sunny",
                temperature_c=25, wind_speed_ms=10, forecast_factor=1.0,
                cost_weight=1.0, carbon_weight=1.0, battery_reserve_percent=10.0)

def config(db):
    record = db.get(SimulationConfig, 1)
    return {**DEFAULTS, **(record.values if record else {})}

def save_config(db, values):
    record = db.get(SimulationConfig, 1)
    if record is None:
        db.add(SimulationConfig(id=1, values=values))
    else:
        record.values = dict(values)

def remember_baseline(db):
    """Retain the first demo snapshot; reset appends records, never deletes history."""
    if db.get(SimulationConfig, 2) is not None:
        return
    state = observed_state(db)
    db.add(SimulationConfig(id=2, values=dict(
        config=config(db), demand=state['demand'], price=state['price'],
        transmission=state['transmission_capacity'],
        batteries={str(b.id): b.status for b in db.query(Battery).all()})))

def observed_state(db):
    grid = db.query(GridState).order_by(GridState.timestamp.desc(), GridState.id.desc()).first()
    price = db.query(MarketPrice).order_by(MarketPrice.timestamp.desc(), MarketPrice.id.desc()).first()
    cfg = config(db)
    solar = sum(a.capacity_mw for a in db.query(SolarFarm).all() if a.status == "active")
    wind = sum(a.capacity_mw for a in db.query(WindFarm).all() if a.status == "active")
    batteries = db.query(Battery).order_by(Battery.id).all()
    return dict(solar_capacity=solar, wind_capacity=wind,
                solar_available=solar * cfg['solar_factor'], wind_available=wind * cfg['wind_factor'],
                demand=grid.current_demand_mw if grid else 250.0,
                price=price.electricity_price_mwh if price else 50.0,
                electricity_price=price.electricity_price_mwh if price else 50.0,
                carbon_price=price.carbon_price_ton if price else 40.0,
                transmission_capacity=grid.transmission_capacity_mw if grid else 1000.0,
                timestamp=grid.timestamp.isoformat() if grid else None,
                interval_hours=0.25, grid_carbon_intensity=0.5,
                batteries=[dict(id=b.id, capacity=b.capacity_mwh, soc=b.current_soc,
                                max_charge=b.max_charge_rate_mw, max_discharge=b.max_discharge_rate_mw,
                                efficiency=b.charge_efficiency, available=b.status == 'active',
                                reserve=b.capacity_mwh * cfg['battery_reserve_percent'] / 100)
                           for b in batteries],
                weights={'cost': cfg['cost_weight'], 'carbon': cfg['carbon_weight']})

def forecast(db):
    state = observed_state(db)
    factor = config(db)['forecast_factor']
    return dict(solar_1hr=min(state['solar_capacity'],state['solar_available'] * factor),
                wind_1hr=min(state['wind_capacity'], state['wind_available'] * factor),
                demand_1hr=state['demand'] * 1.05 * factor,
                timestamp=state['timestamp'], source='Simulation heuristic, not a trained model')

def initial_state(db, event=None):
    observed = observed_state(db)
    if event:
        observed['event'] = event
    return dict(current_situation=observed, forecasts=forecast(db), constraints={}, options=[],
                optimization_result={}, validation_status='', simulation_result={}, decision={},
                explanation='', action_status='', messages=[])

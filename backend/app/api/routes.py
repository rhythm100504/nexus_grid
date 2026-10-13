from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import datetime
from ..agents.orchestrator import agent_app
from ..db.session import get_db
from ..models.assets import SolarFarm, WindFarm, Battery, GridState, MarketPrice, AuditLog, SimulationConfig
from .simulation import config, save_config, observed_state, forecast, initial_state, remember_baseline

api_router = APIRouter()
SCENARIOS = [
    'Solar generation dropped 40%', 'Wind generation increased 30%',
    'Electricity price increased 100%', 'Grid demand increased 25%',
    'Battery B1 unavailable', 'Transmission capacity reduced 90%',
    'Storm warning', 'Weather forecast changed', 'Industrial demand increased 200 MW',
    'Multiple events: solar dropped 40%, price increased 50%'
]

@api_router.get('/state')
def get_state(db: Session = Depends(get_db)):
    s = observed_state(db)
    batteries = s['batteries']
    return dict(solar_mw=s['solar_available'], wind_mw=s['wind_available'], demand_mw=s['demand'],
                battery_soc=sum(b['soc'] for b in batteries) / len(batteries) * 100 if batteries else 0,
                electricity_price=s['price'])

@api_router.get('/assets')
def get_assets(db: Session = Depends(get_db)):
    return dict(solar_farms=db.query(SolarFarm).order_by(SolarFarm.id).all(),
                wind_farms=db.query(WindFarm).order_by(WindFarm.id).all(),
                batteries=db.query(Battery).order_by(Battery.id).all())


def run_and_record(db, event, scenario_id=None, before=None):
    result = agent_app.invoke(initial_state(db, event))
    after = get_state(db)
    details = dict(decision=result['decision'], explanation=result['explanation'],
                   optimization_result=result['optimization_result'], before=before, after=after)
    if scenario_id is not None:
        details['scenario_id'] = scenario_id
    source = observed_state(db)
    db.add(AuditLog(timestamp=datetime.datetime.fromisoformat(source['timestamp']) if source['timestamp'] else datetime.datetime.now(),
                    event=event, details=details))
    db.commit()
    return dict(status='success' if result['validation_status'] == 'PASSED' else 'infeasible',
                scenario_id=scenario_id, message=event, decision=result['decision'],
                explanation=result['explanation'], optimization=result['optimization_result'],
                before=before, after=after)

@api_router.post('/orchestrator/run')
def run_orchestrator(db: Session = Depends(get_db)):
    remember_baseline(db)
    return run_and_record(db, 'Agentic optimization requested')

@api_router.get('/scenarios')
def get_scenarios():
    return [dict(id=i+1, description=message) for i, message in enumerate(SCENARIOS)]

@api_router.post('/scenarios/run')
def run_scenario(scenario_id: int, db: Session = Depends(get_db)):
    if scenario_id < 1 or scenario_id > len(SCENARIOS):
        raise HTTPException(422, 'Unknown scenario')
    grid = db.query(GridState).order_by(GridState.timestamp.desc(), GridState.id.desc()).first()
    price = db.query(MarketPrice).order_by(MarketPrice.timestamp.desc(), MarketPrice.id.desc()).first()
    if not grid or not price:
        raise HTTPException(409, 'Database not initialized. Generate demo data first.')
    before = get_state(db)
    remember_baseline(db)
    cfg = config(db)
    ts = max(grid.timestamp, price.timestamp) + datetime.timedelta(minutes=15)
    new_grid = GridState(timestamp=ts, current_demand_mw=grid.current_demand_mw,
                         grid_frequency_hz=grid.grid_frequency_hz, transmission_capacity_mw=grid.transmission_capacity_mw)
    new_price = MarketPrice(timestamp=ts, electricity_price_mwh=price.electricity_price_mwh,
                           carbon_price_ton=price.carbon_price_ton, demand_response_incentive=price.demand_response_incentive)
    if scenario_id in (1, 10):
        cfg['solar_factor'] *= .6
    if scenario_id == 2:
        cfg['wind_factor'] = min(1.0, cfg['wind_factor'] * 1.3)
        cfg['wind_speed_ms'] *= 1.3
    if scenario_id == 3:
        new_price.electricity_price_mwh *= 2
    if scenario_id == 4:
        new_grid.current_demand_mw *= 1.25
    if scenario_id == 5:
        battery = db.query(Battery).order_by(Battery.id).first()
        if battery:
            battery.status = 'offline'
    if scenario_id == 6:
        new_grid.transmission_capacity_mw *= .1
    if scenario_id == 7:
        cfg.update(weather_status='storm warning', wind_speed_ms=25, temperature_c=18)
        cfg['solar_factor'] *= .5
        cfg['wind_factor'] *= .5
    if scenario_id == 8:
        cfg['forecast_factor'] *= .8
        cfg['weather_status'] = 'forecast changed'
    if scenario_id == 9:
        new_grid.current_demand_mw += 200
    if scenario_id == 10:
        new_price.electricity_price_mwh *= 1.5
    save_config(db, cfg)
    db.add_all([new_grid, new_price])
    db.flush()
    # Changes and the resulting audit are committed together.
    return run_and_record(db, 'Injected: ' + SCENARIOS[scenario_id-1], scenario_id, before)

@api_router.post('/simulation/reset')
def reset_simulation(db: Session = Depends(get_db)):
    remember_baseline(db)
    db.flush()
    baseline = db.get(SimulationConfig, 2).values
    grid = db.query(GridState).order_by(GridState.timestamp.desc(), GridState.id.desc()).first()
    price = db.query(MarketPrice).order_by(MarketPrice.timestamp.desc(), MarketPrice.id.desc()).first()
    if not grid or not price:
        raise HTTPException(409, 'Database not initialized')
    before = get_state(db)
    ts = max(grid.timestamp, price.timestamp) + datetime.timedelta(minutes=15)
    db.add(GridState(timestamp=ts, current_demand_mw=baseline['demand'], grid_frequency_hz=grid.grid_frequency_hz,
                     transmission_capacity_mw=baseline['transmission']))
    db.add(MarketPrice(timestamp=ts, electricity_price_mwh=baseline['price'], carbon_price_ton=price.carbon_price_ton,
                       demand_response_incentive=price.demand_response_incentive))
    cfg = config(db)
    save_config(db, {**baseline['config'], **{key: cfg[key] for key in Settings.model_fields}})
    for battery in db.query(Battery).all():
        battery.status = baseline['batteries'].get(str(battery.id), battery.status)
    db.flush()
    return run_and_record(db, 'Simulation reset to starting conditions', before=before)

@api_router.get('/solar')
def get_solar(db: Session = Depends(get_db)):
    return db.query(SolarFarm).order_by(SolarFarm.id).all()

@api_router.get('/wind')
def get_wind(db: Session = Depends(get_db)):
    return db.query(WindFarm).order_by(WindFarm.id).all()

@api_router.get('/batteries')
def get_batteries(db: Session = Depends(get_db)):
    return db.query(Battery).order_by(Battery.id).all()

@api_router.get('/grid')
def get_grid(db: Session = Depends(get_db)):
    return db.query(GridState).order_by(GridState.timestamp.desc(), GridState.id.desc()).limit(10).all()

@api_router.get('/market')
def get_market(db: Session = Depends(get_db)):
    return db.query(MarketPrice).order_by(MarketPrice.timestamp.desc(), MarketPrice.id.desc()).limit(10).all()

@api_router.get('/weather')
def get_weather(db: Session = Depends(get_db)):
    cfg = config(db)
    return dict(status=cfg['weather_status'], temperature_c=cfg['temperature_c'], wind_speed_ms=cfg['wind_speed_ms'])

@api_router.get('/forecasts')
def get_forecasts(db: Session = Depends(get_db)):
    return forecast(db)

@api_router.get('/decisions')
def get_decisions(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(10).all()

@api_router.get('/decisions/{id}')
def get_decision(id: int, db: Session = Depends(get_db)):
    record = db.get(AuditLog, id)
    if record is None:
        raise HTTPException(404, 'Decision not found')
    return record

@api_router.get('/actions')
def get_actions():
    return []

@api_router.post('/actions/{id}/approve')
@api_router.post('/actions/{id}/reject')
def unavailable_action(id: int):
    raise HTTPException(404, 'No executable action exists; this prototype provides recommendations only.')

@api_router.get('/analytics')
def get_analytics(db: Session = Depends(get_db)):
    rows = db.query(AuditLog).all()
    results = [r.details.get('optimization_result', {}) for r in rows]
    feasible = [r for r in results if r.get('status') == 'OPTIMAL' and 'baseline_cost' in r]
    return dict(cost_savings=sum(r['baseline_cost'] - r['electricity_cost'] for r in feasible),
                carbon_reduction_tons=sum(r['baseline_carbon_tons'] - r['carbon_tons'] for r in feasible),
                recommendation_count=len(feasible), source='Sum of simulated recommendations against an all-grid baseline; not realized savings')

@api_router.get('/audit')
def get_audit(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).all()

@api_router.get('/alerts')
def get_alerts(db: Session = Depends(get_db)):
    alerts = []
    s, cfg = observed_state(db), config(db)
    if cfg['weather_status'] == 'storm warning':
        alerts.append(dict(id='storm', severity='warning', message='Storm warning: simulated renewable availability reduced.', timestamp=s['timestamp']))
    for b in db.query(Battery).all():
        if b.status != 'active':
            alerts.append(dict(id=f'battery-{b.id}', severity='critical', message=f'{b.name} is {b.status} and excluded from dispatch.', timestamp=s['timestamp']))
    if s['transmission_capacity'] < s['demand']:
        alerts.append(dict(id='transmission', severity='warning', message='Transmission capacity is below demand; check the dispatch result.', timestamp=s['timestamp']))
    latest = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    if latest and latest.details.get('optimization_result', {}).get('status') == 'INFEASIBLE':
        alerts.append(dict(id='dispatch', severity='critical', message='Latest dispatch is infeasible. Operator review is required.', timestamp=latest.timestamp.isoformat()))
    return alerts

class Settings(BaseModel):
    cost_weight: float = Field(ge=0, le=100)
    carbon_weight: float = Field(ge=0, le=100)
    battery_reserve_percent: float = Field(ge=0, le=100)

@api_router.get('/settings')
def get_settings(db: Session = Depends(get_db)):
    cfg = config(db)
    return {key: cfg[key] for key in Settings.model_fields}

@api_router.put('/settings')
def update_settings(settings: Settings, db: Session = Depends(get_db)):
    cfg = {**config(db), **settings.model_dump()}
    save_config(db, cfg)
    db.commit()
    return get_settings(db)

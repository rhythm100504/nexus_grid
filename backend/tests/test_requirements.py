"""Real backend regression and requirement checks; strict xfails expose existing gaps.
Temporary SQLite data and the existing no-key LLM fallback are used only for QA.
"""
import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.api.main import app
from app.db.session import get_db
from app.models.base import Base
from app.models.assets import SolarFarm, WindFarm, Battery, GridState, MarketPrice
from app.agents import orchestrator
from app.optimization.engine import run_optimization

@pytest.fixture
def client(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    for i in range(5):
        db.add(SolarFarm(name=f'Test Solar {i+1}', capacity_mw=50, location='Test A', status='active'))
    for i in range(3):
        db.add(WindFarm(name=f'Test Wind {i+1}', capacity_mw=100, location='Test B', status='active'))
    for i in range(2):
        db.add(Battery(name=f'Test Battery {i+1}', capacity_mwh=100, max_charge_rate_mw=50, max_discharge_rate_mw=50, charge_efficiency=.9, current_soc=.5, degradation_factor=.01, status='active'))
    db.add(GridState(timestamp=datetime.datetime(2026,10,9), current_demand_mw=300, grid_frequency_hz=50, transmission_capacity_mw=1000))
    db.add(MarketPrice(timestamp=datetime.datetime(2026,10,9), electricity_price_mwh=50, carbon_price_ton=40, demand_response_incentive=10))
    db.commit()
    def get_test_db():
        session = Session()
        try: yield session
        finally: session.close()
    app.dependency_overrides[get_db] = get_test_db
    monkeypatch.setattr(orchestrator, 'llm', None)
    try:
        with TestClient(app) as test_client: yield test_client
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()

@pytest.mark.parametrize('path', ['state','assets','solar','wind','batteries','grid','market','weather','forecasts','decisions','actions','analytics','audit'])
def test_existing_get_contracts(client,path):
    response = client.get('/api/'+path)
    assert response.status_code == 200
    assert isinstance(response.json(),(dict,list))

def test_state_asset_values(client):
    assets = client.get('/api/assets').json()
    assert [len(assets[k]) for k in ['solar_farms','wind_farms','batteries']] == [5,3,2]
    assert client.get('/api/state').json() == {'solar_mw':175,'wind_mw':180,'battery_soc':50,'demand_mw':300,'electricity_price':50}

def test_real_orchestrator(client):
    body = client.post('/api/orchestrator/run').json()
    assert body['decision']['action'] == 'optimal_dispatch'
    assert body['optimization']['status'] == 'OPTIMAL'
    assert body['decision']['details'] == body['optimization']
    assert str(body['optimization']['battery_discharge']) in body['explanation']
    assert client.get('/api/audit').json() == []

@pytest.mark.parametrize('scenario_id',range(1,11))
def test_scenarios_audit_state_and_decision(client,scenario_id):
    response = client.post('/api/scenarios/run',params={'scenario_id':scenario_id})
    assert response.status_code == 200
    body = response.json()
    assert body['scenario_id'] == scenario_id and body['optimization']['status'] == 'OPTIMAL'
    audit = client.get('/api/audit').json()
    assert len(audit) == 1
    assert audit[0]['details']['scenario_id'] == scenario_id
    assert audit[0]['details']['decision'] == body['decision']
    assert audit[0]['details']['optimization_result'] == body['optimization']
    assert client.get('/api/decisions').json() == audit
    assert client.get(f"/api/decisions/{audit[0]['id']}").json() == audit[0]
    state = client.get('/api/state').json()
    assert state['demand_mw'] == (375 if scenario_id == 4 else 500 if scenario_id == 9 else 300)
    assert state['electricity_price'] == (100 if scenario_id == 3 else 75 if scenario_id == 10 else 50)
    assert client.get('/api/grid').json()[0]['transmission_capacity_mw'] == (100 if scenario_id == 6 else 1000)

def test_invalid_scenario_payload(client):
    assert client.post('/api/scenarios/run').status_code == 422
    assert client.post('/api/scenarios/run?scenario_id=abc').status_code == 422

def opt_state():
    return dict(solar_capacity=200,wind_capacity=100,demand=150,transmission_capacity=1000,battery_max_discharge=50,battery_max_charge=50,solar_available=150,wind_available=80,battery_soc=.5,battery_capacity=100,electricity_price=50)

@pytest.mark.parametrize('soc',[0,.2,.5,.9,1])
def test_optimizer_physical_constraints(soc):
    state = opt_state(); state['battery_soc'] = soc
    r = run_optimization(state,{'cost':1})
    assert r['status'] == 'OPTIMAL'
    assert r['battery_discharge'] <= min(50,soc*100)+1e-7
    assert r['battery_charge'] <= min(50,(1-soc)*100)+1e-7
    assert r['grid_export'] <= state['transmission_capacity']+1e-7
    assert r['solar_gen']+r['solar_curtail'] == pytest.approx(state['solar_available'])
    assert r['wind_gen']+r['wind_curtail'] == pytest.approx(state['wind_available'])
    assert r['solar_gen']+r['wind_gen']+r['grid_import']+r['battery_discharge'] == pytest.approx(state['demand']+r['grid_export']+r['battery_charge'])

def test_competing_objectives():
    results = [run_optimization(opt_state(),{'cost':1,'carbon':c}) for c in [0,100]]
    assert all(r['status']=='OPTIMAL' for r in results)
    assert results[0]['grid_import'] != results[1]['grid_import']

def test_graph_node_execution_order(client):
    initial = {'current_situation':{'demand':300,'price':50},'forecasts':{},'constraints':{},'options':[],'optimization_result':{},'validation_status':'','simulation_result':{},'decision':{},'explanation':'','action_status':'','messages':[]}
    updates = list(orchestrator.agent_app.stream(initial))
    assert [next(iter(u)) for u in updates] == ['analyze_situation','check_forecasts','check_constraints','generate_options','optimize','validate','simulate','evaluate_and_decide','explain']

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: documented GET scenario catalog absent')
def test_requirement_scenario_catalog(client):
    assert client.get('/api/scenarios').status_code == 200

@pytest.mark.parametrize('scenario_id,endpoint,field,multiplier',[(1,'state','solar_mw',.6),(2,'state','wind_mw',1.3)])
@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: renewable event does not change generation')
def test_requirement_renewable_scenarios(client,scenario_id,endpoint,field,multiplier):
    before = client.get('/api/'+endpoint).json()[field]
    client.post('/api/scenarios/run',params={'scenario_id':scenario_id})
    assert client.get('/api/'+endpoint).json()[field] == pytest.approx(before*multiplier)

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: battery event does not change availability')
def test_requirement_battery_outage(client):
    client.post('/api/scenarios/run?scenario_id=5')
    assert client.get('/api/batteries').json()[0]['status'] != 'active'

@pytest.mark.parametrize('scenario_id,endpoint',[(7,'weather'),(8,'forecasts')])
@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: storm/forecast event leaves relevant data unchanged')
def test_requirement_environment_scenarios(client,scenario_id,endpoint):
    before = client.get('/api/'+endpoint).json()
    client.post('/api/scenarios/run',params={'scenario_id':scenario_id})
    assert client.get('/api/'+endpoint).json() != before

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: multiple events does not include solar change')
def test_requirement_multiple_events(client):
    before = client.get('/api/state').json()
    client.post('/api/scenarios/run?scenario_id=10')
    after = client.get('/api/state').json()
    assert after['electricity_price'] != before['electricity_price']
    assert after['solar_mw'] != before['solar_mw']

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: fallback discards observed demand and price')
def test_requirement_observed_state(client):
    result = orchestrator.analyze_situation({'current_situation':{'demand':375,'price':100}})
    assert result['current_situation']['demand'] == 375
    assert result['current_situation']['price'] == 100

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: no execution, monitoring or replan nodes')
def test_requirement_replan(client):
    nodes = orchestrator.agent_app.get_graph().nodes
    assert all(n in nodes for n in ['execute','monitor','replan'])

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: validation unconditionally PASSED')
def test_requirement_validation(client):
    assert orchestrator.validate({'optimization_result':{'status':'INFEASIBLE'}})['validation_status'] != 'PASSED'

@pytest.mark.parametrize('requirement',['transmission','reserve','asset_availability','market'])
@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: missing import/reserve/availability/market constraint')
def test_requirement_optimizer_constraints(requirement):
    state = opt_state()
    state.update(demand=300,solar_available=0,wind_available=0)
    if requirement=='transmission': state.update(transmission_capacity=10,battery_soc=0)
    elif requirement=='reserve': state.update(battery_reserve=40)
    elif requirement=='asset_availability': state.update(battery_available=False)
    else: state.update(market_import_limit=10,battery_soc=0)
    r = run_optimization(state,{'cost':1,'profit':0})
    if requirement in ['transmission','market']: assert r['status']=='INFEASIBLE' or r['grid_import']<=10
    elif requirement=='reserve': assert r['battery_discharge']<=10
    else: assert r['battery_discharge']==0

@pytest.mark.parametrize('risk',['low','medium','high'])
@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: no risk-based approval decision metadata')
def test_requirement_risk_approval(client,risk):
    result = client.post('/api/orchestrator/run').json()
    assert 'risk_level' in result['decision'] and 'approval_status' in result['decision']

@pytest.mark.parametrize('verb',['approve','reject'])
@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: unknown actions accepted without persistence')
def test_requirement_approval_persistence(client,verb):
    assert client.post(f'/api/actions/999/{verb}').status_code == 404

@pytest.mark.xfail(strict=True,reason='PRE-EXISTING: fixed forecasts have no timestamp')
def test_requirement_forecast_timestamp(client):
    assert 'timestamp' in client.get('/api/forecasts').json()

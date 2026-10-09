from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import datetime
from ..agents.orchestrator import agent_app
from ..db.session import get_db
from ..models.assets import SolarFarm, WindFarm, Battery, GridState, MarketPrice, AuditLog

api_router = APIRouter()

@api_router.get("/state")
def get_state(db: Session = Depends(get_db)):
    # In a real app, this would get the most recent state. We get the last one inserted.
    grid = db.query(GridState).order_by(GridState.timestamp.desc()).first()
    price = db.query(MarketPrice).order_by(MarketPrice.timestamp.desc()).first()
    batteries = db.query(Battery).all()
    solar = db.query(SolarFarm).all()
    wind = db.query(WindFarm).all()

    avg_soc = sum([b.current_soc for b in batteries]) / len(batteries) if batteries else 0
    total_solar_cap = sum([s.capacity_mw for s in solar])
    total_wind_cap = sum([w.capacity_mw for w in wind])
    
    return {
        # Mocking real-time generation based on capacity for demo purposes
        "solar_mw": total_solar_cap * 0.7 if total_solar_cap else 120.0,
        "wind_mw": total_wind_cap * 0.6 if total_wind_cap else 80.0,
        "demand_mw": grid.current_demand_mw if grid else 250.0,
        "battery_soc": avg_soc * 100,
        "electricity_price": price.electricity_price_mwh if price else 50.0,
    }

@api_router.get("/assets")
def get_assets(db: Session = Depends(get_db)):
    return {
        "solar_farms": db.query(SolarFarm).all(),
        "wind_farms": db.query(WindFarm).all(),
        "batteries": db.query(Battery).all()
    }

@api_router.post("/orchestrator/run")
def run_orchestrator(db: Session = Depends(get_db)):
    grid = db.query(GridState).order_by(GridState.timestamp.desc()).first()
    price = db.query(MarketPrice).order_by(MarketPrice.timestamp.desc()).first()
    
    initial_state = {
        "current_situation": {
            "demand": grid.current_demand_mw if grid else 200,
            "price": price.electricity_price_mwh if price else 50
        },
        "forecasts": {},
        "constraints": {},
        "options": [],
        "optimization_result": {},
        "validation_status": "",
        "simulation_result": {},
        "decision": {},
        "explanation": "",
        "action_status": "",
        "messages": []
    }
    
    result = agent_app.invoke(initial_state)
    
    return {
        "status": "success", 
        "decision": result.get("decision"),
        "explanation": result.get("explanation"),
        "optimization": result.get("optimization_result")
    }
    
@api_router.post("/scenarios/run")
def run_scenario(scenario_id: int, db: Session = Depends(get_db)):
    # 1. Fetch current grid and market state
    grid = db.query(GridState).order_by(GridState.timestamp.desc()).first()
    price = db.query(MarketPrice).order_by(MarketPrice.timestamp.desc()).first()
    
    if not grid or not price:
        return {"error": "Database not initialized"}

    # 2. Inject anomalies based on scenario
    msg = ""
    new_timestamp = grid.timestamp + datetime.timedelta(minutes=15) if grid.timestamp else datetime.datetime.now()
    
    new_grid = GridState(
        timestamp=new_timestamp,
        current_demand_mw=grid.current_demand_mw,
        grid_frequency_hz=grid.grid_frequency_hz,
        transmission_capacity_mw=grid.transmission_capacity_mw
    )
    new_price = MarketPrice(
        timestamp=new_timestamp,
        electricity_price_mwh=price.electricity_price_mwh,
        carbon_price_ton=price.carbon_price_ton,
        demand_response_incentive=price.demand_response_incentive
    )

    if scenario_id == 1:
        msg = "Injected: Solar generation dropped 40%"
        # We model this by lowering the solar capacity in the system for this tick
        # (Alternatively, we'd add an explicit 'solar_available' column, but for now we reduce demand slightly to simulate less net generation, or just pass it in the prompt)
    elif scenario_id == 2:
        msg = "Injected: Wind generation increased 30%"
    elif scenario_id == 3:
        msg = "Injected: Electricity price increased 100%"
        new_price.electricity_price_mwh *= 2.0
    elif scenario_id == 4:
        msg = "Injected: Grid demand increased 25%"
        new_grid.current_demand_mw *= 1.25
    elif scenario_id == 5:
        msg = "Injected: Battery B1 unavailable"
    elif scenario_id == 6:
        msg = "Injected: Transmission capacity reached"
        new_grid.transmission_capacity_mw *= 0.1 # Severely restrict transmission
    elif scenario_id == 7:
        msg = "Injected: Storm warning"
    elif scenario_id == 8:
        msg = "Injected: Weather forecast change"
    elif scenario_id == 9:
        msg = "Injected: Industrial demand spike"
        new_grid.current_demand_mw += 200 # Sudden industrial load
    elif scenario_id == 10:
        msg = "Injected: Multiple simultaneous events (Solar drop, price spike)"
        new_price.electricity_price_mwh *= 1.5
    else:
        msg = f"Scenario {scenario_id} executed"
        
    # 3. Save new state
    db.add(new_grid)
    db.add(new_price)
    db.commit()

    # 4. Trigger Orchestrator with new state
    initial_state = {
        "current_situation": {
            "demand": new_grid.current_demand_mw,
            "price": new_price.electricity_price_mwh,
            "event": msg
        },
        "forecasts": {},
        "constraints": {},
        "options": [],
        "optimization_result": {},
        "validation_status": "",
        "simulation_result": {},
        "decision": {},
        "explanation": "",
        "action_status": "",
        "messages": []
    }
    
    result = agent_app.invoke(initial_state)
        
    # 5. Record Audit Log
    audit_entry = AuditLog(
        timestamp=new_timestamp,
        event=msg,
        details={
            "scenario_id": scenario_id,
            "decision": result.get("decision"),
            "explanation": result.get("explanation"),
            "optimization_result": result.get("optimization_result")
        }
    )
    db.add(audit_entry)
    db.commit()
    
    return {
        "status": "success", 
        "scenario_id": scenario_id, 
        "message": msg,
        "decision": result.get("decision"),
        "explanation": result.get("explanation"),
        "optimization": result.get("optimization_result")
    }

@api_router.get("/solar")
def get_solar(db: Session = Depends(get_db)):
    return db.query(SolarFarm).all()

@api_router.get("/wind")
def get_wind(db: Session = Depends(get_db)):
    return db.query(WindFarm).all()

@api_router.get("/batteries")
def get_batteries(db: Session = Depends(get_db)):
    return db.query(Battery).all()

@api_router.get("/grid")
def get_grid(db: Session = Depends(get_db)):
    return db.query(GridState).order_by(GridState.timestamp.desc()).limit(10).all()

@api_router.get("/market")
def get_market(db: Session = Depends(get_db)):
    return db.query(MarketPrice).order_by(MarketPrice.timestamp.desc()).limit(10).all()

@api_router.get("/weather")
def get_weather(db: Session = Depends(get_db)):
    return {"status": "sunny", "temperature_c": 25, "wind_speed_ms": 10}

@api_router.get("/forecasts")
def get_forecasts(db: Session = Depends(get_db)):
    return {"solar_1hr": 150, "wind_1hr": 90, "demand_1hr": 350}

@api_router.get("/decisions")
def get_decisions(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()

@api_router.get("/decisions/{id}")
def get_decision(id: int, db: Session = Depends(get_db)):
    return db.query(AuditLog).filter(AuditLog.id == id).first()

@api_router.get("/actions")
def get_actions(db: Session = Depends(get_db)):
    return []

@api_router.post("/actions/{id}/approve")
def approve_action(id: int, db: Session = Depends(get_db)):
    return {"status": "approved", "action_id": id}

@api_router.post("/actions/{id}/reject")
def reject_action(id: int, db: Session = Depends(get_db)):
    return {"status": "rejected", "action_id": id}

@api_router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    return {"cost_savings": 15000, "carbon_reduction_tons": 45}

@api_router.get("/audit")
def get_audit(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()

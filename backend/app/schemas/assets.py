from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class SolarFarmBase(BaseModel):
    name: str
    capacity_mw: float
    location: str
    status: str

class SolarFarm(SolarFarmBase):
    id: int
    class Config:
        from_attributes = True

class BatteryBase(BaseModel):
    name: str
    capacity_mwh: float
    max_charge_rate_mw: float
    max_discharge_rate_mw: float
    charge_efficiency: float
    current_soc: float
    degradation_factor: float
    status: str

class Battery(BatteryBase):
    id: int
    class Config:
        from_attributes = True

class DecisionBase(BaseModel):
    agent_name: str
    situation_summary: str
    selected_action: str
    reasoning: str
    expected_impact: Dict[str, Any]
    confidence: float
    risk_level: str
    approval_status: str

class Decision(DecisionBase):
    id: int
    timestamp: datetime
    class Config:
        from_attributes = True

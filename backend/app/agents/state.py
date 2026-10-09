from typing import TypedDict, List, Dict, Any, Optional

class AgentState(TypedDict):
    current_situation: Dict[str, Any]
    forecasts: Dict[str, Any]
    constraints: Dict[str, Any]
    options: List[Dict[str, Any]]
    optimization_result: Dict[str, Any]
    validation_status: str
    simulation_result: Dict[str, Any]
    decision: Dict[str, Any]
    explanation: str
    action_status: str
    messages: List[Any]

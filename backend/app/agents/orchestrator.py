from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from .state import AgentState
from ..optimization.engine import run_optimization
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Gemini LLM, fallback to dummy if no key provided for demo resilience
api_key = os.getenv("GOOGLE_API_KEY")
if api_key and api_key != "your_gemini_api_key_here" and api_key != "your_actual_key_here":
    llm = ChatGoogleGenerativeAI(model="gemini-3.8-flash", google_api_key=api_key, convert_system_message_to_human=True)
else:
    llm = None

def analyze_situation(state: AgentState):
    if llm:
        sys_prompt = "You are a Renewable Energy Analyst. Summarize the grid state briefly."
        user_prompt = f"Current grid situation: demand is {state.get('current_situation', {}).get('demand', 200)} MW at ${state.get('current_situation', {}).get('price', 50)}/MWh. What is the outlook?"
        response = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
        state['current_situation']['summary'] = response.content
    else:
        state['current_situation'] = {"summary": "Analyzed state (LLM Key Missing)"}
    return state

def check_forecasts(state: AgentState):
    state['forecasts'] = {"solar": 100, "wind": 50, "demand": 150}
    return state

def check_constraints(state: AgentState):
    state['constraints'] = {"transmission": "OK", "battery": "OK"}
    return state

def generate_options(state: AgentState):
    state['options'] = [{"action": "charge_battery"}, {"action": "sell_to_grid"}]
    return state

def optimize(state: AgentState):
    mock_opt_state = {
        'solar_capacity': 200, 'wind_capacity': 100,
        'demand': state.get('current_situation', {}).get('demand', 150),
        'transmission_capacity': 1000,
        'battery_max_discharge': 50, 'battery_max_charge': 50,
        'solar_available': 150, 'wind_available': 80,
        'battery_soc': 0.5, 'battery_capacity': 100,
        'electricity_price': state.get('current_situation', {}).get('price', 50)
    }
    weights = {'cost': 1.0, 'carbon': 1.0}
    state['optimization_result'] = run_optimization(mock_opt_state, weights)
    return state

def validate(state: AgentState):
    state['validation_status'] = "PASSED"
    return state

def simulate(state: AgentState):
    state['simulation_result'] = {"expected_impact": "Positive"}
    return state

def evaluate_and_decide(state: AgentState):
    state['decision'] = {"action": "optimal_dispatch", "details": state.get('optimization_result')}
    return state

def explain(state: AgentState):
    opt_res = state.get('optimization_result', {})
    if llm:
        sys_prompt = "You are a Decision Explanation Agent for a renewable energy orchestrator. Explain the optimization decision clearly in 2-3 sentences based on the data."
        user_prompt = f"Optimization resulted in: battery_discharge={opt_res.get('battery_discharge', 0)} MW, solar_curtail={opt_res.get('solar_curtail', 0)} MW, grid_import={opt_res.get('grid_import', 0)} MW. Why was this chosen?"
        response = llm.invoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
        state['explanation'] = response.content
    else:
        state['explanation'] = f"Optimization resulted in discharging {opt_res.get('battery_discharge', 0)} MW and curtailing {opt_res.get('solar_curtail', 0)} MW. (LLM Key Missing)"
    return state

def build_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("analyze_situation", analyze_situation)
    workflow.add_node("check_forecasts", check_forecasts)
    workflow.add_node("check_constraints", check_constraints)
    workflow.add_node("generate_options", generate_options)
    workflow.add_node("optimize", optimize)
    workflow.add_node("validate", validate)
    workflow.add_node("simulate", simulate)
    workflow.add_node("evaluate_and_decide", evaluate_and_decide)
    workflow.add_node("explain", explain)
    
    workflow.set_entry_point("analyze_situation")
    workflow.add_edge("analyze_situation", "check_forecasts")
    workflow.add_edge("check_forecasts", "check_constraints")
    workflow.add_edge("check_constraints", "generate_options")
    workflow.add_edge("generate_options", "optimize")
    workflow.add_edge("optimize", "validate")
    workflow.add_edge("validate", "simulate")
    workflow.add_edge("simulate", "evaluate_and_decide")
    workflow.add_edge("evaluate_and_decide", "explain")
    workflow.add_edge("explain", END)
    
    return workflow.compile()

agent_app = build_graph()

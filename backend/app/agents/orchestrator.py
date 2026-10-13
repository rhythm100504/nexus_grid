from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from .state import AgentState
from ..optimization.engine import run_optimization
import json
import os
from dotenv import load_dotenv

if os.getenv("VERCEL") != "1":
    load_dotenv()

# Initialize Gemini LLM, fallback to dummy if no key provided for demo resilience
api_key = os.getenv("GOOGLE_API_KEY")
if api_key and api_key != "your_gemini_api_key_here" and api_key != "your_actual_key_here":
    llm = ChatGoogleGenerativeAI(model="gemini-3.8-flash", google_api_key=api_key, convert_system_message_to_human=True)
else:
    llm = None

def analyze_situation(state: AgentState):
    situation = state.setdefault('current_situation', {})
    situation['summary'] = f"Demand {situation.get('demand', 0):.1f} MW at ${situation.get('price', 0):.2f}/MWh."
    if llm:
        try:
            response = llm.invoke([HumanMessage(content=f"Summarize this simulated grid: {situation}")])
            situation['summary'] = response.content
        except Exception:
            situation['summary'] += ' Language model unavailable; using numerical inputs.'
    return state


def check_forecasts(state: AgentState):
    if not state.get('forecasts'):
        situation = state['current_situation']
        state['forecasts'] = {'demand_1hr': situation.get('demand', 0) * 1.05}
    return state


def check_constraints(state: AgentState):
    situation = state['current_situation']
    state['constraints'] = {'transmission_mw': situation.get('transmission_capacity', 1000),
                            'available_batteries': sum(b['available'] for b in situation.get('batteries', []))}
    return state


def generate_options(state: AgentState):
    state['options'] = [{'action': 'renewable_dispatch'}, {'action': 'battery_support'}, {'action': 'grid_exchange'}]
    return state


def optimize(state: AgentState):
    situation = state['current_situation']
    state['optimization_result'] = run_optimization(situation, situation.get('weights', {'cost': 1, 'carbon': 1}))
    return state


def validate(state: AgentState):
    result = state.get('optimization_result', {})
    valid = result.get('status') == 'OPTIMAL'
    if valid and 'demand' in state.get('current_situation', {}):
        supply = sum(result.get(k, 0) for k in ['solar_gen', 'wind_gen', 'grid_import', 'battery_discharge'])
        demand = state['current_situation']['demand'] + result.get('grid_export', 0) + result.get('battery_charge', 0)
        valid = abs(supply - demand) < 1e-5
    state['validation_status'] = 'PASSED' if valid else 'FAILED'
    return state


def simulate(state: AgentState):
    result = state.get('optimization_result', {})
    state['simulation_result'] = {'feasible': state['validation_status'] == 'PASSED',
                                  'electricity_cost': result.get('electricity_cost'),
                                  'carbon_tons': result.get('carbon_tons')}
    return state


def evaluate_and_decide(state: AgentState):
    state['decision'] = {'action': 'optimal_dispatch' if state['validation_status'] == 'PASSED' else 'review_required',
                         'details': state.get('optimization_result')}
    return state


def explain(state: AgentState):
    result = state.get('optimization_result', {})
    demand = state.get('current_situation', {}).get('demand', 0)
    if state.get('validation_status') != 'PASSED':
        state['explanation'] = f"No feasible dispatch for demand of {demand:.1f} MW under the current storage and transmission limits. Operator review is required."
        return state
    state['explanation'] = (
        f"For demand of {demand:.1f} MW, use {result.get('solar_gen', 0):.1f} MW solar and "
        f"{result.get('wind_gen', 0):.1f} MW wind. Discharge {result.get('battery_discharge', 0):.1f} MW "
        f"from batteries, charge {result.get('battery_charge', 0):.1f} MW, import "
        f"{result.get('grid_import', 0):.1f} MW and export {result.get('grid_export', 0):.1f} MW. "
        "This balances the simulated demand within asset and transmission limits. (Solver-based explanation)"
    )
    if llm:
        try:
            response = llm.invoke([HumanMessage(content=f"Explain this simulated dispatch in 2 sentences: demand={demand}, result={result}")])
            state['explanation'] = response.content
        except Exception:
            pass
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

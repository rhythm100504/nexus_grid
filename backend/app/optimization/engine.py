from ortools.linear_solver import pywraplp

def run_optimization(state: dict, weights: dict):
    # state: current solar, wind, demand, battery, prices
    solver = pywraplp.Solver.CreateSolver('GLOP')
    if not solver:
        return {"error": "Solver not created."}

    # Time horizon: 1 interval for now, can be extended
    
    # Variables
    # Generation
    solar_gen = solver.NumVar(0, state['solar_capacity'], 'solar_gen')
    wind_gen = solver.NumVar(0, state['wind_capacity'], 'wind_gen')
    
    # Grid
    grid_import = solver.NumVar(0, solver.infinity(), 'grid_import')
    grid_export = solver.NumVar(0, state['transmission_capacity'], 'grid_export')
    
    # Battery
    battery_discharge = solver.NumVar(0, state['battery_max_discharge'], 'battery_discharge')
    battery_charge = solver.NumVar(0, state['battery_max_charge'], 'battery_charge')
    
    # Curtailment
    solar_curtail = solver.NumVar(0, state['solar_capacity'], 'solar_curtail')
    wind_curtail = solver.NumVar(0, state['wind_capacity'], 'wind_curtail')

    # Constraints
    # 1. Power Balance
    # Generation + Import + Battery Discharge == Demand + Export + Battery Charge
    solver.Add(solar_gen + wind_gen + grid_import + battery_discharge == 
               state['demand'] + grid_export + battery_charge)
               
    # 2. Renewables availability
    solver.Add(solar_gen + solar_curtail == state['solar_available'])
    solver.Add(wind_gen + wind_curtail == state['wind_available'])
    
    # 3. Battery limits based on current SOC
    # Can't discharge more than what's available
    solver.Add(battery_discharge <= state['battery_soc'] * state['battery_capacity'])
    # Can't charge more than available headroom
    solver.Add(battery_charge <= (1 - state['battery_soc']) * state['battery_capacity'])

    # Objectives (minimize)
    # Cost = import * price - export * price
    cost = grid_import * state['electricity_price'] - grid_export * state['electricity_price']
    
    # Carbon = import * grid_carbon_intensity
    carbon = grid_import * state.get('grid_carbon_intensity', 0.5)
    
    # Curtailment penalty
    curtailment = solar_curtail + wind_curtail
    
    # Battery degradation penalty
    degradation = battery_discharge + battery_charge

    # Apply weights
    objective = (
        weights.get('cost', 1.0) * cost +
        weights.get('carbon', 1.0) * carbon * state.get('carbon_price', 50) +
        weights.get('curtailment', 1.0) * curtailment * 10 +
        weights.get('battery_degradation', 1.0) * degradation * 5 -
        weights.get('profit', 1.0) * (grid_export * state['electricity_price']) # Maximize profit
    )
    
    solver.Minimize(objective)
    
    status = solver.Solve()
    
    if status == pywraplp.Solver.OPTIMAL:
        return {
            "status": "OPTIMAL",
            "solar_gen": solar_gen.solution_value(),
            "wind_gen": wind_gen.solution_value(),
            "grid_import": grid_import.solution_value(),
            "grid_export": grid_export.solution_value(),
            "battery_charge": battery_charge.solution_value(),
            "battery_discharge": battery_discharge.solution_value(),
            "solar_curtail": solar_curtail.solution_value(),
            "wind_curtail": wind_curtail.solution_value(),
            "objective_value": solver.Objective().Value()
        }
    else:
        return {"status": "INFEASIBLE"}

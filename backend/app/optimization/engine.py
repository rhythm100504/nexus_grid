from ortools.linear_solver import pywraplp


def run_optimization(state: dict, weights: dict):
    """Single interval; mode enumeration prevents simultaneous opposing flows."""
    interval = state.get('interval_hours', 1.0)
    batteries = state.get('batteries', [dict(
        capacity=state.get('battery_capacity', 0), soc=state.get('battery_soc', 0),
        max_charge=state.get('battery_max_charge', 0), max_discharge=state.get('battery_max_discharge', 0),
        efficiency=state.get('battery_efficiency', 1), available=state.get('battery_available', True),
        reserve=state.get('battery_reserve', 0))])
    best = None
    for grid_mode in ['import', 'export']:
        for battery_mode in ['charge', 'discharge']:
            solver = pywraplp.Solver.CreateSolver('GLOP')
            if solver is None:
                return {'status': 'ERROR', 'error': 'Solver not available'}
            solar = solver.NumVar(0, state['solar_capacity'], 'solar_gen')
            wind = solver.NumVar(0, state['wind_capacity'], 'wind_gen')
            limit = max(0, state['transmission_capacity'])
            imports = solver.NumVar(0, min(limit, state.get('market_import_limit', limit)) if grid_mode == 'import' else 0, 'grid_import')
            exports = solver.NumVar(0, min(limit, state.get('market_export_limit', limit)) if grid_mode == 'export' else 0, 'grid_export')
            charges, discharges = [], []
            for i, b in enumerate(batteries):
                energy, efficiency = b['soc'] * b['capacity'], b['efficiency']
                charge_limit = min(b['max_charge'], max(0, b['capacity'] - energy) / (interval * efficiency))
                discharge_limit = min(b['max_discharge'], max(0, energy - b.get('reserve', 0)) * efficiency / interval)
                charges.append(solver.NumVar(0, charge_limit if b['available'] and battery_mode == 'charge' else 0, f'charge_{i}'))
                discharges.append(solver.NumVar(0, discharge_limit if b['available'] and battery_mode == 'discharge' else 0, f'discharge_{i}'))
            charge, discharge = sum(charges), sum(discharges)
            sc = solver.NumVar(0, state['solar_available'], 'solar_curtail')
            wc = solver.NumVar(0, state['wind_available'], 'wind_curtail')
            solver.Add(solar + sc == state['solar_available'])
            solver.Add(wind + wc == state['wind_available'])
            solver.Add(solar + wind + imports + discharge == state['demand'] + exports + charge)
            price = state['electricity_price']
            cost = (imports * price - exports * price) * interval
            carbon = imports * state.get('grid_carbon_intensity', .5) * interval
            solver.Minimize(weights.get('cost', 1) * cost + weights.get('carbon', 1) * carbon * state.get('carbon_price', 50)
                            + weights.get('curtailment', 1) * (sc + wc) * 10 * interval
                            + weights.get('battery_degradation', 1) * (charge + discharge) * 5 * interval)
            if solver.Solve() != pywraplp.Solver.OPTIMAL:
                continue
            objective = solver.Objective().Value()
            if best is None or objective < best['objective_value'] - 1e-7:
                variables = dict(solar_gen=solar, wind_gen=wind, grid_import=imports, grid_export=exports,
                                 solar_curtail=sc, wind_curtail=wc)
                best = {k: max(0, v.solution_value()) for k, v in variables.items()}
                best.update(status='OPTIMAL', battery_charge=sum(v.solution_value() for v in charges),
                            battery_discharge=sum(v.solution_value() for v in discharges), objective_value=objective,
                            interval_hours=interval, electricity_cost=cost.solution_value(), carbon_tons=carbon.solution_value(),
                            baseline_cost=state['demand'] * price * interval,
                            baseline_carbon_tons=state['demand'] * state.get('grid_carbon_intensity', .5) * interval)
    return best or {'status': 'INFEASIBLE', 'error': 'Available generation, storage and transmission cannot meet demand.'}

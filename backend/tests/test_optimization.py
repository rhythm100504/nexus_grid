import pytest
from app.optimization.engine import run_optimization

def test_run_optimization():
    state = {
        'solar_capacity': 200, 'wind_capacity': 100,
        'demand': 150, 'transmission_capacity': 1000,
        'battery_max_discharge': 50, 'battery_max_charge': 50,
        'solar_available': 150, 'wind_available': 80,
        'battery_soc': 0.5, 'battery_capacity': 100,
        'electricity_price': 50
    }
    weights = {'cost': 1.0}
    result = run_optimization(state, weights)
    assert result['status'] == 'OPTIMAL'
    assert result['objective_value'] is not None

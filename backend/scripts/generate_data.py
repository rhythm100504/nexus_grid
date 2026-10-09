import sys
import os
import random
from datetime import datetime, timedelta

# Add parent dir to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine, SessionLocal
from app.models.base import Base
from app.models.assets import SolarFarm, WindFarm, Battery, GridState, MarketPrice

def generate_data():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Generate Assets
    if db.query(SolarFarm).count() == 0:
        print("Generating Solar Farms...")
        for i in range(5):
            db.add(SolarFarm(name=f"Solar Farm {i+1}", capacity_mw=random.uniform(20, 100), location="Region A", status="active"))
            
    if db.query(WindFarm).count() == 0:
        print("Generating Wind Farms...")
        for i in range(3):
            db.add(WindFarm(name=f"Wind Farm {i+1}", capacity_mw=random.uniform(50, 150), location="Region B", status="active"))
            
    if db.query(Battery).count() == 0:
        print("Generating Batteries...")
        for i in range(2):
            db.add(Battery(name=f"Battery {i+1}", capacity_mwh=100, max_charge_rate_mw=50, max_discharge_rate_mw=50, charge_efficiency=0.9, current_soc=0.5, degradation_factor=0.01, status="active"))
    
    # Generate historical grid state for 24 hours, 15 min intervals
    if db.query(GridState).count() == 0:
        print("Generating Grid State time-series data...")
        start_time = datetime.now() - timedelta(hours=24)
        for i in range(24 * 4):
            current_time = start_time + timedelta(minutes=15 * i)
            # simulate daily demand curve
            hour = current_time.hour
            base_demand = 300
            if 8 <= hour <= 18:
                base_demand += 150  # daytime peak
            if 18 < hour <= 22:
                base_demand += 250  # evening peak
                
            db.add(GridState(
                timestamp=current_time,
                current_demand_mw=base_demand + random.uniform(-20, 20),
                grid_frequency_hz=50.0 + random.uniform(-0.05, 0.05),
                transmission_capacity_mw=1000.0
            ))
            
            db.add(MarketPrice(
                timestamp=current_time,
                electricity_price_mwh=50.0 + (base_demand / 10) + random.uniform(-5, 5),
                carbon_price_ton=40.0,
                demand_response_incentive=10.0
            ))

    db.commit()
    db.close()
    print("Synthetic data generation complete.")

if __name__ == "__main__":
    generate_data()

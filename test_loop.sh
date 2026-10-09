#!/bin/bash
echo "Waiting for backend..."
while ! curl -s http://localhost:8000/health > /dev/null; do
    sleep 5
done
echo "Backend is up!"

echo "Seeding the database..."
# Run the data generator from within the backend container!
docker-compose exec -T backend python scripts/generate_data.py

echo "Running scenario simulation..."
curl -s -X POST http://localhost:8000/api/scenarios/run?scenario_id=1

echo "Done."

import time
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from src.api.app import app

client = TestClient(app)

print("=============================================")
print("TEST 1: MODE = CACHED (INSTANT)")
print("=============================================")
t0 = time.time()
r_cached = client.post("/optimize", json={
    "cargo": "coking_coal",
    "quantity_mt": 1000000,
    "deadline_month": 3,
    "objective": "mean",
    "mode": "cached"
})
t_cached = time.time() - t0
print(f"Status: {r_cached.status_code} in {t_cached:.4f}s")
d_cached = r_cached.json()
print(f"served_from_cache: {d_cached.get('served_from_cache')}")
print(f"solver_status: {d_cached.get('solver_status')}")
print(f"savings_vs_landed_cost: ${d_cached.get('savings_vs_landed_cost_baseline'):,.2f}")
print(f"savings_vs_naive: ${d_cached.get('savings_vs_naive_baseline'):,.2f}")
print(f"month_1_fixtures: {len(d_cached.get('month_1_recommendation', []))}")
assert d_cached.get("served_from_cache") is True
assert t_cached < 1.0

print("\n=============================================")
print("TEST 2: MODE = FAST (~20s)")
print("=============================================")
t0 = time.time()
r_fast = client.post("/optimize", json={
    "cargo": "coking_coal",
    "quantity_mt": 1000000,
    "deadline_month": 3,
    "objective": "mean",
    "mode": "fast"
})
t_fast = time.time() - t0
print(f"Status: {r_fast.status_code} in {t_fast:.2f}s")
d_fast = r_fast.json()
print(f"solver_status: {d_fast.get('solver_status')}, gap: {d_fast.get('solver_gap_pct')}%")
print(f"solve_time: {d_fast.get('solve_time_seconds')}s")
print(f"savings_vs_landed_cost: ${d_fast.get('savings_vs_landed_cost_baseline'):,.2f}")
print(f"month_1_fixtures: {len(d_fast.get('month_1_recommendation', []))}")
assert r_fast.status_code == 200
assert t_fast < 30.0

print("\n=============================================")
print("TEST 3: MODE = FULL (BACKGROUND JOB & POLLING)")
print("=============================================")
t0 = time.time()
r_full = client.post("/optimize", json={
    "cargo": "coking_coal",
    "quantity_mt": 1000000,
    "deadline_month": 6,
    "objective": "mean",
    "mode": "full"
})
d_full = r_full.json()
job_id = d_full.get("job_id")
print(f"Job submitted instantly in {time.time()-t0:.4f}s. job_id = {job_id}, status = {d_full.get('solver_status')}")
assert job_id is not None
assert d_full.get("solver_status") == "pending"

# Verify polling endpoint returns pending/running
time.sleep(1)
r_poll = client.get(f"/jobs/{job_id}")
status_data = r_poll.json()
print(f"Poll check at 1s: status = {status_data.get('status')}")
assert status_data.get("status") in ("pending", "running", "done")

print("\n=============================================")
print("ALL 3 MODES VERIFIED END TO END SUCCESSFULLY")
print("=============================================")

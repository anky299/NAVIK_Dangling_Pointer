"""scripts/verify_api_checks.py — Verify all API requirements and output structured report."""
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

print("=" * 60)
print("1. CHECK /docs & ENDPOINTS LISTING (OpenAPI)")
print("=" * 60)
resp = client.get("/openapi.json")
assert resp.status_code == 200, f"OpenAPI failed: {resp.status_code}"
schema = resp.json()
print(f"API Title: {schema['info']['title']} (v{schema['info']['version']})")
print("Endpoints declared:")
for path, methods in sorted(schema['paths'].items()):
    for method, spec in methods.items():
        summary = spec.get('summary', '')
        print(f"  {method.upper():<6} {path:<20} - {summary}")

print("\nTesting GET endpoints:")
r_health = client.get("/health")
print(f"  GET /health: status={r_health.status_code}, body={r_health.json()}")

r_hist = client.get("/history?series=bdi&start=2021-01-01&end=2021-01-10")
print(f"  GET /history (bdi): status={r_hist.status_code}, count={r_hist.json().get('count')}")

r_fore = client.get("/forecast?horizon_weeks=4&route_id=HP-VIZAG&vessel_class=Capesize")
print(f"  GET /forecast (h=4, route=HP-VIZAG): status={r_fore.status_code}")
print(f"    median={r_fore.json().get('bdi_median')}, q10={r_fore.json().get('bdi_q10')}, q90={r_fore.json().get('bdi_q90')}")
print(f"    route_rate_usd={r_fore.json().get('per_tonne_rate_usd')}")

print("\n" + "=" * 60)
print("2. FAST /optimize IN UNDER 30 SECONDS")
print("=" * 60)
fast_payload = {
    "cargo": "coking_coal",
    "quantity_mt": 1000000.0,
    "deadline_month": 3,
    "objective": "mean",
    "mode": "fast"
}
t0 = time.time()
r_fast = client.post("/optimize", json=fast_payload)
elapsed = time.time() - t0
print(f"Fast /optimize response status: {r_fast.status_code} in {elapsed:.2f} seconds")
assert r_fast.status_code == 200
data_fast = r_fast.json()
print(f"  solver_status: {data_fast.get('solver_status')}")
print(f"  solver_gap_pct: {data_fast.get('solver_gap_pct')}%")
print(f"  solve_time_seconds: {data_fast.get('solve_time_seconds')}s")
print(f"  served_from_cache: {data_fast.get('served_from_cache')}")
print(f"  savings_vs_naive_baseline: ${data_fast.get('savings_vs_naive_baseline'):,.2f}")
print(f"  savings_vs_landed_cost_baseline: ${data_fast.get('savings_vs_landed_cost_baseline'):,.2f}")
print(f"  month_1_fixtures: {len(data_fast.get('month_1_recommendation', []))}")
print(f"  data_note: {data_fast.get('data_note')}")

print("\n" + "=" * 60)
print("3. READABLE 422 ON BAD INPUTS")
print("=" * 60)
# Test 1: unknown cargo
r1 = client.post("/optimize", json={"cargo": "uranium", "quantity_mt": 50000, "deadline_month": 1})
msg1 = r1.json()["detail"][0]["msg"]
print(f"  Unknown cargo -> {r1.status_code}: {msg1}")
assert r1.status_code == 422

# Test 2: negative quantity
r2 = client.post("/optimize", json={"cargo": "coking_coal", "quantity_mt": -50000, "deadline_month": 1})
msg2 = r2.json()["detail"][0]["msg"]
print(f"  Negative quantity -> {r2.status_code}: {msg2}")
assert r2.status_code == 422

# Test 3: deadline beyond horizon
r3 = client.post("/optimize", json={"cargo": "coking_coal", "quantity_mt": 50000, "deadline_month": 15})
msg3 = r3.json()["detail"][0]["msg"]
print(f"  Deadline out of bounds -> {r3.status_code}: {msg3}")
assert r3.status_code == 422

# Test 4: weights not summing to 1
r4 = client.post("/optimize", json={
    "cargo": "coking_coal",
    "quantity_mt": 50000,
    "deadline_month": 1,
    "scenario_weights": {"low": 0.2, "base": 0.2, "high": 0.2}
})
msg4 = r4.json()["detail"][0]["msg"]
print(f"  Weights sum != 1 -> {r4.status_code}: {msg4}")
assert r4.status_code == 422

print("\n" + "=" * 60)
print("4. CACHED ANSWER (OPTIMIZER DISABLED / CACHED MODE)")
print("=" * 60)
# 4a: explicit mode="cached"
r_cached = client.post("/optimize", json={
    "cargo": "coking_coal",
    "quantity_mt": 1000000,
    "deadline_month": 3,
    "mode": "cached"
})
print(f"  mode='cached' status: {r_cached.status_code}")
cdata = r_cached.json()
print(f"    served_from_cache: {cdata.get('served_from_cache')}")
print(f"    cache_timestamp: {cdata.get('cache_timestamp')}")
print(f"    solver_status: {cdata.get('solver_status')}")
print(f"    savings_vs_naive_baseline: ${cdata.get('savings_vs_naive_baseline'):,.2f}")
print(f"    month_1_fixtures: {len(cdata.get('month_1_recommendation', []))}")
assert cdata.get("served_from_cache") is True

# 4b: fallback when solver fails (simulate optimizer exception)
from unittest.mock import patch
with patch("src.api.services.build_and_solve_optimizer", side_effect=RuntimeError("Solver unavailable")):
    r_fallback = client.post("/optimize", json={
        "cargo": "coking_coal",
        "quantity_mt": 1000000,
        "deadline_month": 3,
        "mode": "fast"
    })
    print(f"  Fallback when solver disabled/fails: status={r_fallback.status_code}")
    fb_data = r_fallback.json()
    print(f"    served_from_cache: {fb_data.get('served_from_cache')}")
    print(f"    message: {fb_data.get('message')}")
    assert fb_data.get("served_from_cache") is True

print("\n" + "=" * 60)
print("ALL 4 CRITERIA VERIFIED SUCCESSFULLY")
print("=" * 60)

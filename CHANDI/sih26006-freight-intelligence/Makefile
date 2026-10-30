.PHONY: install test api dashboard demo precompute backtest clean

# Install Python and Node dependencies
install:
	python3 -m pip install -r requirements.txt
	cd app && npm install

# Run entire pytest suite (106 tests)
test:
	python3 -m pytest -v

# Run FastAPI backend with auto-reload
api:
	python3 -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000 --reload

# Run Vite frontend dashboard
dashboard:
	cd app && npm run dev -- --host 127.0.0.1 --port 5173

# Recompute offline plan cache
precompute:
	python3 scripts/precompute_cache.py

# Run full walk-forward 2023 backtest replay
backtest:
	python3 scripts/run_backtest.py --start 2023-01-01 --end 2023-12-31

# Launch full demo (Backend API on :8000 + Frontend Dashboard on :5173)
demo:
	@echo "======================================================================"
	@echo "Launching SAIL Freight Intelligence Platform Demo..."
	@echo "Backend API:        http://127.0.0.1:8000 (Swagger docs: /docs)"
	@echo "Frontend Dashboard: http://127.0.0.1:5173"
	@echo "======================================================================"
	python3 -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000 & \
	cd app && npm run dev -- --host 127.0.0.1 --port 5173

# Clean temporary artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

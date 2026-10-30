/**
 * API client for SAIL Freight Intelligence backend.
 * Default URL: http://localhost:8000 (configurable via VITE_API_URL).
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      let errMsg = `Request failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          if (Array.isArray(errJson.detail)) {
            errMsg = errJson.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
          } else {
            errMsg = errJson.detail;
          }
        }
      } catch (e) {
        // ignore json parse error
      }
      throw new Error(errMsg);
    }

    return await res.json();
  } catch (err) {
    console.error(`API Error [${path}]:`, err);
    throw err;
  }
}

export async function fetchHealth() {
  return request('/health');
}

export async function fetchHistory(series = 'bdi', start = null, end = null) {
  const params = new URLSearchParams({ series });
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  return request(`/history?${params.toString()}`);
}

export async function fetchForecast(horizonWeeks = 4, routeId = null, vesselClass = null) {
  const params = new URLSearchParams({ horizon_weeks: horizonWeeks });
  if (routeId) params.append('route_id', routeId);
  if (vesselClass) params.append('vessel_class', vesselClass);
  return request(`/forecast?${params.toString()}`);
}

export async function runOptimize(payload) {
  return request('/optimize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchJobStatus(jobId) {
  return request(`/jobs/${jobId}`);
}

export async function runScenarios(payload) {
  return request('/scenarios', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchInsights() {
  return request('/insights');
}

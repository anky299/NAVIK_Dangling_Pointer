import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  Info,
  Calendar,
  Layers,
  Ship,
  Database,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { fetchHistory, fetchForecast } from '../api';

const SERIES_OPTIONS = [
  { id: 'bdi', label: 'Baltic Dry Index (BDI)', type: 'index', defaultVessel: 'Capesize' },
  { id: 'bci', label: 'Capesize Index (BCI)', type: 'subindex', defaultVessel: 'Capesize' },
  { id: 'bpi', label: 'Panamax Index (BPI)', type: 'subindex', defaultVessel: 'Panamax' },
  { id: 'bsi', label: 'Supramax Index (BSI)', type: 'subindex', defaultVessel: 'Supramax' },
  { id: 'bhsi', label: 'Handysize Index (BHSI)', type: 'subindex', defaultVessel: 'Handysize' },
  { id: 'brent', label: 'Brent Crude ($/bbl)', type: 'macro', defaultVessel: 'Capesize' },
  { id: 'usdinr', label: 'USD / INR Rate', type: 'macro', defaultVessel: 'Capesize' },
];

const ROUTE_OPTIONS = [
  { id: 'HAY_VTZ', label: 'Hay Point (AUS) → Visakhapatnam', origin: 'Hay Point', dest: 'Visakhapatnam' },
  { id: 'HAY_PRT', label: 'Hay Point (AUS) → Paradip', origin: 'Hay Point', dest: 'Paradip' },
  { id: 'NEW_PRT', label: 'Newcastle (AUS) → Paradip', origin: 'Newcastle', dest: 'Paradip' },
  { id: 'HMP_GVR', label: 'Hampton Roads (USA) → Gangavaram', origin: 'Hampton Roads', dest: 'Gangavaram' },
  { id: 'NAC_DHM', label: 'Nacala (MOZ) → Dhamra', origin: 'Nacala', dest: 'Dhamra' },
  { id: 'VAN_VTZ', label: 'Vanino (RUS) → Visakhapatnam', origin: 'Vanino', dest: 'Visakhapatnam' },
  { id: 'SAM_HLD', label: 'Samarinda (IDN) → Haldia', origin: 'Samarinda / Taboneo', dest: 'Haldia' },
];

const VESSEL_CLASSES = ['Capesize', 'Panamax', 'Supramax', 'Handysize'];
const HORIZONS = [1, 4, 8, 12];

export default function ForecastScreen() {
  const [selectedSeries, setSelectedSeries] = useState('bdi');
  const [selectedRoute, setSelectedRoute] = useState('HAY_VTZ');
  const [selectedVessel, setSelectedVessel] = useState('Capesize');
  const [horizonWeeks, setHorizonWeeks] = useState(4);

  const [historyData, setHistoryData] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [routeRatesTable, setRouteRatesTable] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load history data for selected series
  useEffect(() => {
    let isCancelled = false;
    async function loadHistory() {
      try {
        setError(null);
        // Request 2 years of history
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const startStr = twoYearsAgo.toISOString().split('T')[0];

        const res = await fetchHistory(selectedSeries, startStr);
        if (!isCancelled) {
          setHistoryData(res.data || []);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load historical time series');
        }
      }
    }
    loadHistory();
    return () => { isCancelled = true; };
  }, [selectedSeries]);

  // Load forecast data
  useEffect(() => {
    let isCancelled = false;
    async function loadForecast() {
      setLoading(true);
      try {
        const fc = await fetchForecast(horizonWeeks, selectedRoute, selectedVessel);
        if (!isCancelled) {
          setForecastData(fc);
        }

        // Fetch per-tonne rates across all vessel classes for the selected route
        const ratesMap = {};
        await Promise.all(
          VESSEL_CLASSES.map(async (vClass) => {
            try {
              const r = await fetchForecast(horizonWeeks, selectedRoute, vClass);
              if (r.per_tonne_rate_usd !== undefined && r.per_tonne_rate_usd !== null) {
                ratesMap[vClass] = r.per_tonne_rate_usd;
              }
            } catch (e) {
              // vessel class might not be eligible
            }
          })
        );
        if (!isCancelled) {
          setRouteRatesTable(ratesMap);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to fetch forward forecast');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadForecast();
    return () => { isCancelled = true; };
  }, [horizonWeeks, selectedRoute, selectedVessel]);

  // Latest historical value
  const latestHistorical = useMemo(() => {
    if (!historyData || historyData.length === 0) return null;
    return historyData[historyData.length - 1];
  }, [historyData]);

  // Percent change from current to median forecast
  const pctChange = useMemo(() => {
    if (!latestHistorical || !forecastData || !forecastData.bdi_median) return null;
    const current = latestHistorical.value;
    const future = forecastData.bdi_median;
    if (current === 0) return 0;
    return ((future - current) / current) * 100;
  }, [latestHistorical, forecastData]);

  // Merge history with forward forecast point for Chart
  const chartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];

    // Subsample weekly if daily data is dense (e.g. step every 5 days for smooth render)
    const sampled = [];
    const step = historyData.length > 300 ? 5 : 1;
    for (let i = 0; i < historyData.length; i += step) {
      const pt = historyData[i];
      sampled.push({
        date: pt.date,
        historical: pt.value,
        isDerived: pt.is_derived,
        q10: null,
        q50: null,
        q90: null,
        range: null,
      });
    }

    // Ensure latest point is present
    const lastHist = historyData[historyData.length - 1];
    if (sampled[sampled.length - 1].date !== lastHist.date) {
      sampled.push({
        date: lastHist.date,
        historical: lastHist.value,
        isDerived: lastHist.is_derived,
        q10: null,
        q50: null,
        q90: null,
        range: null,
      });
    }

    // Connect bridge point
    const lastDate = new Date(lastHist.date);
    const bridgeItem = {
      date: lastHist.date,
      historical: lastHist.value,
      isDerived: false,
      q10: lastHist.value,
      q50: lastHist.value,
      q90: lastHist.value,
      range: [lastHist.value, lastHist.value],
    };
    sampled[sampled.length - 1] = bridgeItem;

    // Add future forecast point
    if (forecastData) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + horizonWeeks * 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      sampled.push({
        date: futureDateStr,
        historical: null,
        isDerived: false,
        isForecastPoint: true,
        q10: forecastData.bdi_q10,
        q50: forecastData.bdi_median,
        q90: forecastData.bdi_q90,
        range: [forecastData.bdi_q10, forecastData.bdi_q90],
      });
    }

    return sampled;
  }, [historyData, forecastData, horizonWeeks]);

  const forecastStartDate = latestHistorical?.date;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy tracking-tight">Freight Rate Forecast</h2>
          <p className="text-sm text-slate-500 mt-1">
            Calibrated LightGBM quantile curves (q10, q50, q90) and route freight rate simulation.
          </p>
        </div>

        {forecastData?.served_from_cache && (
          <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs text-slate-600 font-medium">
            <Database className="w-3.5 h-3.5 text-teal" />
            <span>Cached result ({forecastData._cached_at ? new Date(forecastData._cached_at).toLocaleTimeString() : 'precomputed'})</span>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Series Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Market Index / Commodity
            </label>
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {SERIES_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Route Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Maritime Corridor
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {ROUTE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Vessel Class Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Vessel Class
            </label>
            <select
              value={selectedVessel}
              onChange={(e) => setSelectedVessel(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {VESSEL_CLASSES.map((vc) => (
                <option key={vc} value={vc}>
                  {vc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Horizon Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Forecast Horizon
          </label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {HORIZONS.map((h) => {
              const active = horizonWeeks === h;
              return (
                <button
                  key={h}
                  onClick={() => setHorizonWeeks(h)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    active
                      ? 'bg-teal text-white shadow-sm'
                      : 'text-slate-600 hover:text-navy hover:bg-slate-200/60'
                  }`}
                >
                  {h}W
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Current Level */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Current Value</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-navy">
              {latestHistorical ? latestHistorical.value.toLocaleString() : '—'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {latestHistorical ? latestHistorical.date : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Historical spot close from verified data series.
          </p>
        </div>

        {/* Card 2: Horizon Forecast (Median & Band) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>{horizonWeeks}-Week Forecast</span>
            <TrendingUp className="w-4 h-4 text-teal" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-teal">
              {forecastData?.bdi_median ? forecastData.bdi_median.toLocaleString() : '—'}
            </span>
            <div className="text-xs font-semibold text-slate-600 mt-1 flex items-center space-x-1">
              <span className="text-slate-400 font-normal">80% Band:</span>
              <span className="text-navy font-bold">
                [{forecastData?.bdi_q10 ? forecastData.bdi_q10.toLocaleString() : '—'} –{' '}
                {forecastData?.bdi_q90 ? forecastData.bdi_q90.toLocaleString() : '—'}]
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Split-conformal calibrated prediction interval.
          </p>
        </div>

        {/* Card 3: Change % */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Expected Trend</span>
            {pctChange !== null && pctChange >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-amber" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-teal" />
            )}
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl font-bold ${
                pctChange !== null && pctChange >= 0 ? 'text-amber-dark' : 'text-teal'
              }`}
            >
              {pctChange !== null ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Relative delta from current spot to week +{horizonWeeks} median.
          </p>
        </div>

        {/* Card 4: Calibration Coverage */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Calibration Status</span>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xs text-slate-700 font-medium mt-2 leading-relaxed">
            {forecastData?.calibration_note || 'Calibrated via split-conformal regression.'}
          </p>
          <div className="mt-2.5 inline-flex items-center text-[11px] font-semibold text-teal-dark bg-teal/10 px-2 py-0.5 rounded">
            Target 80% empirical coverage
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-bold text-navy">
              Historical Series & Forward Quantile Diffusion
            </h3>
            <p className="text-xs text-slate-500">
              Navy line: 2-year observed market trajectory • Teal band: q10–q90 conformal interval.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-navy inline-block" />
              <span className="text-slate-600 font-medium">Spot History</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-teal/40 inline-block" />
              <span className="text-slate-600 font-medium">q10–q90 Band</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-teal inline-block" />
              <span className="text-slate-600 font-medium">Forecast Median (q50)</span>
            </span>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="h-80 w-full mt-4">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-lg">
              <div className="flex flex-col items-center space-y-2 text-slate-400 text-sm">
                <Clock className="w-6 h-6 animate-spin text-teal" />
                <span>Computing forecast curves...</span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full w-full flex items-center justify-center bg-red-50/50 rounded-lg text-risk text-sm">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => {
                    if (!val) return '';
                    const parts = val.split('-');
                    return parts.length >= 2 ? `${parts[0].slice(2)}/${parts[1]}` : val;
                  }}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => Number(val).toLocaleString()}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg text-xs space-y-1">
                        <div className="font-bold text-navy border-b border-slate-100 pb-1 mb-1">
                          Date: {label}
                        </div>
                        {d.historical !== null && (
                          <div className="text-slate-700">
                            Observed: <span className="font-bold text-navy">{Number(d.historical).toLocaleString()}</span>
                            {d.isDerived && <span className="ml-1 text-[10px] text-amber-dark font-medium">(derived)</span>}
                          </div>
                        )}
                        {d.q50 !== null && (
                          <div className="text-teal font-semibold">
                            Median (q50): <span className="font-bold">{Number(d.q50).toLocaleString()}</span>
                          </div>
                        )}
                        {d.q10 !== null && d.q90 !== null && (
                          <div className="text-slate-500">
                            80% Band: [{Number(d.q10).toLocaleString()} – {Number(d.q90).toLocaleString()}]
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {/* Shading for post-2019 derived sub-indices */}
                {selectedSeries !== 'bdi' && selectedSeries !== 'brent' && selectedSeries !== 'usdinr' && (
                  <ReferenceArea
                    x1="2019-08-01"
                    fill="#F2A541"
                    fillOpacity={0.08}
                    label={{ value: 'Derived Sub-Index Data', position: 'insideTopLeft', fill: '#B45309', fontSize: 10 }}
                  />
                )}

                {/* Vertical reference marker for start of forecast */}
                {forecastStartDate && (
                  <ReferenceLine
                    x={forecastStartDate}
                    stroke="#F2A541"
                    strokeDasharray="4 4"
                    label={{ value: 'Forecast Horizon', position: 'top', fill: '#B45309', fontSize: 11 }}
                  />
                )}

                {/* Conformal interval shaded band */}
                <Area
                  type="monotone"
                  dataKey="range"
                  fill="#13A89E"
                  fillOpacity={0.25}
                  stroke="#13A89E"
                  strokeWidth={1}
                  connectNulls
                  isAnimationActive={false}
                />

                {/* Historical Observed Series */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#0B2545"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />

                {/* Forecast Median Line */}
                <Line
                  type="monotone"
                  dataKey="q50"
                  stroke="#13A89E"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#13A89E' }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Required Caution Footnote */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center space-x-2 text-xs font-semibold text-amber-dark">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber" />
          <span>
            Accuracy at 8 to 12 weeks is close to a naive forecast; use bands, not point values.
          </span>
        </div>
      </div>

      {/* Corridor Benchmark Rates Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-navy flex items-center space-x-2">
              <Ship className="w-4 h-4 text-teal" />
              <span>Corridor Rate Simulation: {ROUTE_OPTIONS.find(r => r.id === selectedRoute)?.label}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Derived unit shipping cost ($/MT) computed via voyage-cost physics formula at median BDI rate.
            </p>
          </div>
          <span className="text-xs font-bold text-teal bg-teal/10 px-2.5 py-1 rounded-md">
            +{horizonWeeks}-Week Arrival Window
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Vessel Class</th>
                <th className="py-2.5 px-4">Standard Parcel</th>
                <th className="py-2.5 px-4">Cruising Speed</th>
                <th className="py-2.5 px-4">Voyage Freight Rate</th>
                <th className="py-2.5 px-4">Cost Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {VESSEL_CLASSES.map((vc) => {
                const rate = routeRatesTable[vc];
                const isSelected = vc === selectedVessel;
                let parcel = '60,000 MT';
                let speed = '13.0 kn';
                if (vc === 'Capesize') { parcel = '155,000 MT'; speed = '13.0 kn'; }
                if (vc === 'Panamax') { parcel = '70,000 MT'; speed = '13.0 kn'; }
                if (vc === 'Supramax') { parcel = '52,000 MT'; speed = '12.5 kn'; }
                if (vc === 'Handysize') { parcel = '30,000 MT'; speed = '12.0 kn'; }

                return (
                  <tr
                    key={vc}
                    onClick={() => setSelectedVessel(vc)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal/5 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 flex items-center space-x-2 text-navy">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-teal' : 'bg-slate-300'}`} />
                      <span>{vc}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{parcel}</td>
                    <td className="py-3 px-4 text-slate-600">{speed}</td>
                    <td className="py-3 px-4 text-navy font-bold">
                      {rate !== undefined ? `$${rate.toFixed(2)} / MT` : 'Not eligible / Draft limit'}
                    </td>
                    <td className="py-3 px-4">
                      {rate !== undefined ? (
                        <span className="text-xs font-medium text-teal-dark bg-teal/10 px-2 py-0.5 rounded">
                          {vc === 'Capesize' ? 'Lowest $/MT scale' : 'Draft-flexible'}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Exceeds port draft</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

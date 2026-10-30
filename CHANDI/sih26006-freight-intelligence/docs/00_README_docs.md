# Documentation Index — SIH26006
**Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement**  
*Ministry of Steel · Steel Authority of India Limited (SAIL) · Smart India Hackathon 2026*

---

## Overview

This directory contains the foundational specifications, scope definitions, architectural designs, and data plans developed for Segment 0.

| Document | Title | Description |
|---|---|---|
| [01_problem_summary.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/01_problem_summary.md) | **Problem Summary** | Plain English problem context, user personas, operational hurdles, formal system obligations, and success metrics. |
| [02_scope.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/02_scope.md) | **Project Scope** | Explicit definitions of cargo types, origin loading ports, East Coast destination ports with draft/LOA limits, vessel classes, system decisions, forecast horizons, and out-of-scope boundaries. |
| [02_data_inventory.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/02_data_inventory.md) | **Data Inventory & Provenance** | Register of all data categories (D01–D08), access verification status, licensing constraints, data readiness gate, and fallback paths. |
| [03_architecture.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/03_architecture.md) | **System Architecture** | Mermaid end-to-end dataflow diagram (Data Layer, Intelligence Layer, Application Layer) with input/output and tech specs for each component. |
| [04_data_requirements.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/04_data_requirements.md) | **Data Requirements & Synthetic Plan** | Granular dataset requirement table with priorities, free sources to verify, fallbacks, and the synthetic route-rate generation methodology. |
| [data_inventory_report.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/data_inventory_report.md) | **Data Inventory Report** | Automated diagnostics report generated from raw loaders, tracking frequencies, missing data, and date gaps. |
| [data_sources.md](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/data_sources.md) | **Data Sources Register** | Canonical registry of raw files, official providers, frequencies, verified date spans, licensing, and methodological limitations. |

---

## Segment 0 Status Checklist

- [x] Folder structure and git repository initialized
- [x] [`docs/01_problem_summary.md`](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/01_problem_summary.md) derived strictly from official SIH26006 statement
- [x] [`docs/02_scope.md`](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/02_scope.md) created defining cargo, ports with draft limits, vessels, decisions, horizons, and out-of-scope items
- [x] [`docs/02_data_inventory.md`](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/02_data_inventory.md) cataloged with verification statuses and fallback sources
- [x] [`docs/03_architecture.md`](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/03_architecture.md) Mermaid flow renders cleanly across Data, Intelligence, and Application layers
- [x] [`docs/04_data_requirements.md`](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/docs/04_data_requirements.md) defined with priorities and synthetic data formula
- [x] All document cross-references, port lists, vessel classes, and origin routes aligned without contradictions

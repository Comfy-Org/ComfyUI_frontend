# perf-data

Rolling historical performance baselines for ComfyUI_frontend CI.

This orphan branch stores JSON measurement files used for z-score computation in the `pr-perf-report.yaml` workflow. Files are automatically updated by CI on each main branch merge.

## Structure

```
perf-history/
  <commit-sha>.json   # Individual run measurements
perf-baseline.json     # Rolling 20-run aggregate baseline
```

## Usage

This branch is consumed by the CI workflow `ci-perf-report.yaml`. Do not commit manually — data is managed by automation.

# Playwright Test Sharding Strategy

## Overview

This document describes the optimized sharding strategy for Playwright tests to achieve balanced execution times across parallel CI jobs.

## Problem

The original naive sharding approach (dividing tests equally by file count) resulted in imbalanced execution times:
- Shard 5 (chromium): 9 minutes
- Other shards: 2-6 minutes

This was due to `interaction.spec.ts` containing 61 tests with 81 screenshot comparisons, making it significantly heavier than other test files.

## Solution

### 1. Weighted Test Distribution

Tests are assigned weights based on:
- Number of test cases
- Screenshot comparisons (heavy operations)
- Test complexity (DOM manipulation, async operations)
- Historical execution time

### 2. Optimized Shard Configuration

The sharding configuration uses a greedy algorithm to distribute tests:
1. Sort tests by weight (heaviest first)
2. Assign each test to the shard with lowest total weight
3. Result: ~4.5% imbalance vs. previous 80% imbalance

### 3. Project-Specific Sharding

- **chromium**: 5 shards with optimized distribution
- **chromium-2x, chromium-0.5x**: No sharding (fast enough)
- **mobile-chrome**: No sharding (fast enough)

## Implementation

### Generated Configuration

Run `pnpm test:browser:optimize-shards` to regenerate the shard configuration based on current test weights.

### Files

- `shardConfig.generated.ts`: Auto-generated shard assignments
- `playwright-sharded.config.ts`: Playwright config using optimized shards
- `scripts/optimizeSharding.js`: Script to analyze and optimize distribution

### CI Configuration

The GitHub workflow uses a matrix strategy with explicit shard configurations:

```yaml
matrix:
  include:
    - browser: chromium
      shard: 1
      shard-total: 5
    # ... etc
```

## Shard Distribution (Balanced)

| Shard | Weight | Key Tests |
|-------|--------|-----------|
| 1 | 225 | interaction.spec.ts (heavy screenshots) |
| 2 | 220 | subgraph.spec.ts, workflows, primitives |
| 3 | 225 | widget.spec.ts, nodeLibrary, templates |
| 4 | 215 | nodeSearchBox, rightClickMenu, colorPalette |
| 5 | 215 | dialog, groupNode, remoteWidgets |

## Monitoring

After deployment, monitor CI execution times to ensure shards remain balanced. If new heavy tests are added, re-run the optimization script.

## Maintenance

1. When adding new heavy tests, update `TEST_WEIGHTS` in `optimizeSharding.js`
2. Run `pnpm test:browser:optimize-shards`
3. Commit the updated `shardConfig.generated.ts`

## Expected Results

- All chromium shards complete in 3-4 minutes (vs. 2-9 minutes)
- Total CI time reduced from 9 minutes to ~4 minutes
- Better resource utilization in CI runners
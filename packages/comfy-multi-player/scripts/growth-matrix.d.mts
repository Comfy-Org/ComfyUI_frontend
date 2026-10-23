// Hand-written declaration for scripts/growth-matrix.mjs so test/growth-matrix.test.ts
// can import the SAME harness the bench script runs (tsconfig has no allowJs).
import type * as YNs from "yjs";
import type { applyOps as applyOpsFn, mint as mintFn } from "../src/index.js";

export const MAX_OPS_PER_BATCH: number;

export interface GrowthSample {
  ops: number;
  total: number;
  liveAll: number;
  history: number;
  live: Record<string, number>;
}

export interface GrowthSlopes {
  total: number;
  liveAll: number;
  history: number;
  live: Record<string, number>;
}

export interface WorkloadResult {
  name: string;
  nodes: number;
  opCount: number;
  unit: "op" | "node";
  samples: GrowthSample[];
  slopes: GrowthSlopes;
}

export interface GrowthCmp {
  Y: typeof YNs;
  mint: typeof mintFn;
  applyOps: typeof applyOpsFn;
}

export interface GrowthOptions {
  opCount?: number;
  checkpoints?: number;
  workloads?: string[];
}

export const CATALOG: {
  catalog_version: string;
  types: Record<string, { widget_order: string[] }>;
};
export function ksamplerNode(id: number): unknown;
export function workflow(n: number): unknown;
export function opId(i: number): string;
export function runWorkload(
  cmp: GrowthCmp,
  name: string,
  opts?: GrowthOptions,
): WorkloadResult;
export function runGrowthMatrix(
  cmp: GrowthCmp,
  opts?: GrowthOptions,
): Record<string, WorkloadResult>;
export function formatMatrix(results: Record<string, WorkloadResult>): string;

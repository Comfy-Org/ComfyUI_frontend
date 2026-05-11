/**
 * Test harness for the v2 extension API — I-TF.3 / I-TF.6 wiring.
 *
 * Re-exports only the functions tests need today. Auxiliary types
 * (HarnessWorld, MiniComfyApp, RunV1Result, etc.) are intentionally
 * re-exported one PR later, when filled-in tests start declaring
 * variables of those types — keeping the public surface in lockstep
 * with actual consumers (and quiet for `pnpm knip`).
 */
export { createHarnessWorld } from './world'
export { createMiniComfyApp } from './comfyApp'
export { runV1 } from './runV1'
export { runV2 } from './runV2'
export {
  countEvidenceExcerpts,
  listPatternIds,
  loadEvidenceSnippet
} from './loadEvidenceSnippet'

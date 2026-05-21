/**
 * Test harness for the v2 extension API — I-TF.3 / I-TF.6 wiring.
 *
 * Re-exports functions and types tests need.
 */
export { createHarnessWorld } from './world'
export type { HarnessWorld, HarnessNodeRecord, EntityId } from './world'
export { createMiniComfyApp } from './comfyApp'
export type { MiniComfyApp, MiniGraph } from './comfyApp'
export { runV1 } from './runV1'
export { runV2 } from './runV2'
export {
  countEvidenceExcerpts,
  listPatternIds,
  loadEvidenceSnippet
} from './loadEvidenceSnippet'

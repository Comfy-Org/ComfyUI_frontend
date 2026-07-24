import type { LiteGraphGlobal } from './LiteGraphGlobal'

/**
 * Late-bound holder for the {@link LiteGraphGlobal} singleton.
 *
 * This module imports `LiteGraphGlobal` as a type only, so it has no runtime
 * dependencies. Modules in the widget initialisation chain (e.g. `draw.ts`,
 * imported transitively by `BaseWidget`) can read singleton constants through
 * {@link litegraph} without importing the `litegraph` barrel — which would
 * re-enter the barrel mid-initialisation and evaluate
 * `LegacyWidget extends BaseWidget` before `BaseWidget` is defined.
 *
 * The barrel constructs the singleton and calls {@link registerLiteGraphInstance}.
 */
let instance: LiteGraphGlobal | null = null

export function registerLiteGraphInstance(value: LiteGraphGlobal): void {
  instance = value
}

export function litegraph(): LiteGraphGlobal {
  if (!instance) {
    throw new Error('LiteGraph singleton accessed before initialisation')
  }
  return instance
}

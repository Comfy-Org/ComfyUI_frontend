/// <reference types="vite/client" />
/**
 * Template for the per-pack specs build_matrix.py emits into
 * src/__ecs_matrix__/. Checked in so tsc sees the shape that actually runs:
 * a runPack signature change breaks this file, instead of surfacing as a
 * vitest parse error inside a job that tolerates a nonzero vitest exit.
 *
 * build_matrix.py substitutes the four placeholder constants below and
 * repoints the runner import at the copy it makes; it aborts the build if a
 * placeholder is missing, duplicated, or left behind.
 */
import { describe, it } from 'vitest'

import { runPack } from './matrix_runner'

const PACK = '__MATRIX_PACK__'
const SAFE = '__MATRIX_SAFE__'
const ENTRIES: string[] = ['__MATRIX_ENTRIES__']
const loaders = import.meta.glob('./packs/__MATRIX_PACK_DIR__/**/*.{js,mjs}')

describe('matrix ' + PACK, () => {
  it('runs the op battery', async () => {
    await runPack(PACK, loaders, ENTRIES, SAFE)
  }, 300_000)
})

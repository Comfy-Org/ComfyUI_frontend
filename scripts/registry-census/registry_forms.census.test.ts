// @vitest-environment happy-dom
/**
 * The baseline registry form census: `proveWidgetForm` over every class in
 * `object_info.shape.json`, with no pack code loaded.
 *
 * Run through `vitest.census.config.mts`, never as part of `test:unit` and
 * never as part of the gated ecosystem matrix:
 *
 *     CENSUS_FORMS_OUT=.census/results/registry-forms.json \
 *       npx vitest run --config vitest.census.config.mts
 *
 * It is a measurement, so it asserts only that the measurement happened —
 * population size and registration success. Asserting a provable RATE here
 * would turn a census into a floor, and a refusal is the predicate working.
 */
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { loadShapeDefs, runRegistryCensus } from './matrix_runner'

const OUT =
  process.env.CENSUS_FORMS_OUT ?? '.census/results/registry-forms.json'

describe('registry form census', () => {
  it(
    'proves or refuses a form for every registered class',
    { timeout: 900_000 },
    async () => {
      const classes = Object.keys(loadShapeDefs()).length
      await runRegistryCensus(OUT)
      const { registryForms } = JSON.parse(fs.readFileSync(OUT, 'utf8')) as {
        registryForms: {
          err?: string
          classes: number
          registered: number
          histogram: Record<string, number>
        }
      }
      expect(registryForms.err).toBeUndefined()
      expect(registryForms.classes).toBe(classes)
      // Every class registered, and every registered class got a verdict. Both
      // halves matter: a registration that silently dropped classes, or a
      // verdict loop that skipped them, would both read as a clean population.
      expect(registryForms.registered).toBe(classes)
      const verdicts = Object.values(registryForms.histogram).reduce(
        (a, b) => a + b,
        0
      )
      expect(verdicts).toBe(classes)
    }
  )
})

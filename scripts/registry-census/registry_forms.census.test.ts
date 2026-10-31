// @vitest-environment happy-dom
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
      expect(registryForms.registered).toBe(classes)
      const verdicts = Object.values(registryForms.histogram).reduce(
        (a, b) => a + b,
        0
      )
      expect(verdicts).toBe(classes)
    }
  )
})

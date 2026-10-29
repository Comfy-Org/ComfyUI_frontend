import { describe, expect, it } from 'vitest'

interface Perturbation {
  name: string
  apply(): void
}

interface ServerFactGate<T> {
  name: string
  fact: { set(value: boolean): void }
  perturbations: readonly Perturbation[]
  mount(): Promise<T> | T
  read(subject: T): unknown
}

const FACT_VALUES = [true, false] as const

/**
 * Orthogonality check for ADR-API-SERVER-FACTS-0042: a gate renders one
 * server fact. Every perturbation of a non-fact input must leave `read()`
 * unchanged for either fact value, and flipping the fact must change it.
 */
export function describeServerFactGate<T>({
  name,
  fact,
  perturbations,
  mount,
  read
}: ServerFactGate<T>) {
  async function readWith(value: boolean, perturbation?: Perturbation) {
    perturbation?.apply()
    fact.set(value)
    return read(await mount())
  }

  describe(`${name} renders one server fact`, () => {
    const cases = FACT_VALUES.flatMap((value) =>
      perturbations.map((perturbation) => ({ value, perturbation }))
    )

    it.for(cases)(
      'ignores $perturbation.name when the fact is $value',
      async ({ value, perturbation }) => {
        const baseline = await readWith(value)
        expect(await readWith(value, perturbation)).toEqual(baseline)
      }
    )

    it('changes when the fact flips', async () => {
      expect(await readWith(true)).not.toEqual(await readWith(false))
    })
  })
}

import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { readExperimentVariant } from './postHogExperimentClient'
import { useExperimentVariant } from './useExperimentVariant'

vi.mock(import('./postHogExperimentClient'), () => ({
  readExperimentVariant: vi.fn<typeof readExperimentVariant>()
}))

const VARIANTS = ['control', 'top-banner', 'inside-input'] as const
type Variant = (typeof VARIANTS)[number]

function run<T>(body: () => T): T {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const result = scope.run(body)
  if (result === undefined) throw new Error('scope disposed before running')
  return result
}

function startExperiment(eligible = ref(true)) {
  return run(() =>
    useExperimentVariant<Variant>({
      flagKey: 'some-experiment',
      variants: VARIANTS,
      control: 'control',
      eligible
    })
  )
}

describe('useExperimentVariant', () => {
  beforeEach(() => {
    vi.mocked(readExperimentVariant).mockResolvedValue('top-banner')
  })

  it('does not read the flag while the viewer is ineligible', async () => {
    const eligible = ref(false)
    const { variant } = startExperiment(eligible)
    await nextTick()

    expect(readExperimentVariant).not.toHaveBeenCalled()
    expect(variant.value).toBe('control')
  })

  it('reads the flag once the viewer becomes eligible', async () => {
    const eligible = ref(false)
    const { variant } = startExperiment(eligible)

    eligible.value = true
    await vi.waitFor(() => expect(variant.value).toBe('top-banner'))
    expect(readExperimentVariant).toHaveBeenCalledWith('some-experiment')
  })

  it.for([
    { name: 'a variant outside the experiment', value: 'bottom-sheet' },
    { name: 'no assignment at all', value: undefined }
  ])('falls back to control given $name', async ({ value }) => {
    const read = Promise.resolve(value)
    vi.mocked(readExperimentVariant).mockReturnValue(read)
    const { variant } = startExperiment()

    await read
    expect(variant.value).toBe('control')
  })

  it('falls back to control when the read rejects', async () => {
    const read = Promise.reject(new Error('offline'))
    vi.mocked(readExperimentVariant).mockReturnValue(read)
    const { variant } = startExperiment()

    await read.catch(() => undefined)
    expect(variant.value).toBe('control')
  })

  it('keeps one assignment for the session as eligibility flickers', async () => {
    const eligible = ref(true)
    const { variant } = startExperiment(eligible)
    await vi.waitFor(() => expect(variant.value).toBe('top-banner'))

    vi.mocked(readExperimentVariant).mockResolvedValue('inside-input')
    eligible.value = false
    await nextTick()
    eligible.value = true
    await nextTick()

    expect(readExperimentVariant).toHaveBeenCalledTimes(1)
    expect(variant.value).toBe('top-banner')
  })
})

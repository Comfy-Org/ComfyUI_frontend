import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  isForeignExecutionNoise,
  unallowlistedErrors,
  unallowlistedErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'

// unallowlistedErrors is the sole enforcement point of the curated-run
// console gate (customNode.regression.spec.ts T1): a degradation to
// "always empty" would turn that gate vacuously green, so the filter's
// three behaviors are pinned here directly.
test.describe('consoleErrorLedger', () => {
  test('filters only errors matching the pack own patterns', () => {
    const errors = [
      'Failed to load resource: the server responded with a status of 404 () http://host/example.png',
      'TypeError: something real broke'
    ]
    expect(unallowlistedErrors('ComfyUI-Impact-Pack', errors)).toEqual([
      'TypeError: something real broke'
    ])
  })

  test('a pattern never filters for a pack that does not own it', () => {
    const error = "Cannot use 'in' operator to search for 'content' in null"
    expect(unallowlistedErrors('ComfyUI-Impact-Pack', [error])).toEqual([error])
    expect(unallowlistedErrors('ComfyUI-Custom-Scripts', [error])).toEqual([])
  })

  test('unknown pack fails open: every error surfaces', () => {
    // The first error would match an Impact pattern; with no ledger for the
    // pack, nothing may be filtered.
    const errors = [
      'Failed to load resource: the server responded with a status of 404 () http://host/example.png',
      'boom'
    ]
    expect(unallowlistedErrors('Some-Future-Pack', errors)).toEqual(errors)
  })

  test('cross-pack variant filters only via packs in scope', () => {
    // Both observed editor_base subclasses match the mechanism pattern.
    const kjErrors = [
      "Error creating SplineEditor: TypeError: Cannot read properties of null (reading 'replaceChild')",
      "Error creating PointsEditor: TypeError: Cannot read properties of null (reading 'replaceChild')"
    ]
    // Owning pack in scope: ledgered. Absent: the error surfaces, so a pack
    // outside the sweep corpus can never vouch for an error.
    expect(
      unallowlistedErrorsForPacks(
        ['ComfyUI-Impact-Pack', 'ComfyUI-KJNodes'],
        [...kjErrors, 'boom']
      )
    ).toEqual(['boom'])
    expect(
      unallowlistedErrorsForPacks(['ComfyUI-Impact-Pack'], kjErrors)
    ).toEqual(kjErrors)
  })
})

// Filters a prior tier's async execution error out of the non-executing
// tiers; must match execution-domain lines and nothing a mount/wiring tier
// should legitimately catch.
test.describe('isForeignExecutionNoise', () => {
  test('matches the execution-domain console surfaces', () => {
    expect(isForeignExecutionNoise('PromptExecutionError: boom')).toBe(true)
    expect(isForeignExecutionNoise('Prompt execution failed')).toBe(true)
    expect(
      isForeignExecutionNoise(
        'Failed to load resource: the server responded with a status of 400 (Bad Request) http://127.0.0.1:8288/api/prompt'
      )
    ).toBe(true)
  })

  test('does not match render or unrelated resource errors a tier must catch', () => {
    expect(
      isForeignExecutionNoise('TypeError: cannot read x of undefined')
    ).toBe(false)
    expect(
      isForeignExecutionNoise(
        'Failed to load resource: 404 http://127.0.0.1:8288/api/view?filename=x.png'
      )
    ).toBe(false)
    expect(
      isForeignExecutionNoise('Uncaught page error: something rendered wrong')
    ).toBe(false)
  })
})

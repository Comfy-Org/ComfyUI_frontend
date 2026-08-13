import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  isForeignExecutionNoise,
  staleRequiredConnectivityErrorRulesForPacks,
  unallowlistedErrors,
  unallowlistedConnectivityErrorsForPacks,
  unallowlistedErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'

// unallowlistedErrors is the sole enforcement point of the curated load and
// run console gates (pack startup/load and curated workflow execution): a degradation
// to "always empty" would turn those gates vacuously green, so the filter's
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

  test('pins the MathExpression stale-nodeOutputs sweep crash to its connectivity rule', () => {
    const captured =
      "TypeError: Cannot read properties of undefined (reading '0')\n" +
      '    at MathExpression.onDrawForeground (http://localhost:8188/extensions/ComfyUI-Custom-Scripts/js/mathExpression.js:31:52)'
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['ComfyUI-Custom-Scripts'],
        [captured]
      )
    ).toEqual([])
    // The same crash without the mathExpression frame must still surface.
    const elsewhere =
      "TypeError: Cannot read properties of undefined (reading '0')\n" +
      '    at draw (http://localhost:8188/extensions/ComfyUI-Custom-Scripts/js/widgetDefaults.js:9:3)'
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['ComfyUI-Custom-Scripts'],
        [elsewhere]
      )
    ).toEqual([elsewhere])
  })

  test('matches the pack key case-insensitively', () => {
    const errors = [
      'Failed to load resource: the server responded with a status of 404 () http://host/example.png',
      'TypeError: something real broke'
    ]
    expect(unallowlistedErrors('comfyui-impact-pack', errors)).toEqual([
      'TypeError: something real broke'
    ])
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

  test('connectivity mechanisms are pack-scoped and required', () => {
    const points =
      'Error parsing stored points: SyntaxError: Unexpected end of JSON input\n    at new PointsEditor (http://localhost/extensions/ComfyUI-KJNodes/js/editors/point_editor_canvas.js:77:26)'
    const vhs =
      "Uncaught page error: TypeError: Cannot read properties of undefined (reading 'target_id')\n    at get_links (http://localhost/extensions/ComfyUI-VideoHelperSuite/js/VHS.core.js:2096:71)"
    const spline =
      "Error creating SplineEditor: TypeError: Cannot read properties of undefined (reading 'x')\n    at Object.buildPathD (http://localhost/extensions/ComfyUI-KJNodes/js/editors/interpolation.js:132:27)"
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['ComfyUI-KJNodes', 'ComfyUI-VideoHelperSuite'],
        [points, vhs, spline]
      )
    ).toEqual([spline])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(
        ['ComfyUI-KJNodes', 'ComfyUI-VideoHelperSuite'],
        [points, vhs]
      )
    ).toEqual([])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(
        ['ComfyUI-KJNodes', 'ComfyUI-VideoHelperSuite'],
        []
      )
    ).toEqual(['kj-points-empty-bbox-json', 'core-vhs-removed-link-target-id'])
  })

  test('allows only the exact pysssss None-default 404 without requiring it', () => {
    const pysssss404 =
      'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:8188/api/pysssss/examples/loras%2FNone]'
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['ComfyUI-Custom-Scripts'],
        [pysssss404]
      )
    ).toEqual([])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(
        ['ComfyUI-Custom-Scripts'],
        []
      )
    ).toEqual([])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(
        ['ComfyUI-Custom-Scripts'],
        [pysssss404]
      )
    ).toEqual([])
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['ComfyUI-Custom-Scripts'],
        [
          pysssss404.replace('404', '500'),
          pysssss404.replace('localhost:8188', 'localhost:4040'),
          pysssss404.replace('loras%2FNone', 'loras%2FOther')
        ]
      )
    ).toHaveLength(3)
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['ComfyUI-VideoHelperSuite'],
        [pysssss404]
      )
    ).toEqual([pysssss404])
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

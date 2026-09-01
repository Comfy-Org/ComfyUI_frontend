import { describe, expect, it } from 'vitest'
import {
  consoleErrorExclusionsForPacks,
  customExtensionStartupErrors,
  isForeignExecutionNoise,
  staleRequiredConnectivityErrorRulesForPacks,
  staleRequiredStartupErrorRulesForPacks,
  unallowlistedErrors,
  unallowlistedConnectivityErrorsForPacks,
  unallowlistedGlobalExtensionErrorsForPacks,
  unallowlistedErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'
import { loadAllManifestPackNames } from '@e2e/fixtures/customNode/manifest'

// unallowlistedErrors is the sole enforcement point of the curated load and
// run console gates (pack startup/load and curated workflow execution): a degradation
// to "always empty" would turn those gates vacuously green, so the filter's
// three behaviors are pinned here directly.
describe('consoleErrorLedger', () => {
  it('startup attribution excludes core boot noise and keeps extension failures', () => {
    expect(
      customExtensionStartupErrors([
        'Failed to load resource: 404 [http://localhost:8188/user.css]',
        'ComfyApp graph accessed before initialization [http://localhost:8188/assets/app.js]',
        'Failed to load resource: 404 [http://localhost:8188/extensions/core/clipspace.js]',
        'Failed to load resource: 404 [http://localhost:8188/extensions/Pack/widget.js]',
        "Error calling extension 'Pack.feature' method 'setup'",
        "[vite:preloadError] {message: Unexpected token '}'} [http://localhost:8188/assets/main.js]"
      ])
    ).toEqual([
      'Failed to load resource: 404 [http://localhost:8188/extensions/Pack/widget.js]',
      "Error calling extension 'Pack.feature' method 'setup'",
      "[vite:preloadError] {message: Unexpected token '}'} [http://localhost:8188/assets/main.js]"
    ])
  })

  it('required startup errors fail stale and filter only their exact signatures', () => {
    const error =
      "[vite:preloadError] {url: null, message: Unexpected token '}'} [http://localhost:8188/assets/main-abc.js]"
    expect(
      staleRequiredStartupErrorRulesForPacks(['WhatDreamsCost-ComfyUI'], [])
    ).toEqual(['WhatDreamsCost-ComfyUI/ltx-director-guide-syntax'])
    expect(
      staleRequiredStartupErrorRulesForPacks(
        ['WhatDreamsCost-ComfyUI'],
        [error]
      )
    ).toEqual([])
    expect(
      unallowlistedGlobalExtensionErrorsForPacks(
        ['WhatDreamsCost-ComfyUI'],
        [error, 'different failure']
      )
    ).toEqual(['different failure'])
  })

  it('reports every console acceptance with unique removal metadata', () => {
    const exclusions = consoleErrorExclusionsForPacks([
      ...new Map(
        loadAllManifestPackNames().map((pack) => [pack.toLowerCase(), pack])
      ).values()
    ])
    expect(new Set(exclusions.map(({ label }) => label)).size).toBe(
      exclusions.length
    )
    expect(exclusions.every(({ reason }) => reason.length > 0)).toBe(true)
    expect(exclusions.every(({ restore }) => restore.length > 0)).toBe(true)
    expect(exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'WhatDreamsCost-ComfyUI console ltx-director-guide-syntax',
          mode: 'expected-failure',
          scope: 'startup and pack operations',
          tier: 'S8'
        }),
        expect.objectContaining({
          label:
            'WhatDreamsCost-ComfyUI console whatdreams-set-value-probe-preview',
          mode: 'conditional-console',
          scope: 'startup and pack operations',
          tier: 'S8'
        }),
        expect.objectContaining({
          label:
            'ComfyUI-LTXVideo connectivity console ltx-sparse-track-null-image-size',
          mode: 'expected-failure',
          scope: 'S4 connectivity sweep',
          tier: 'S8'
        }),
        expect.objectContaining({
          label:
            'ComfyUI-KJNodes connectivity console kj-points-empty-bbox-json',
          mode: 'conditional-console',
          scope: 'S4 connectivity sweep',
          tier: 'S8'
        })
      ])
    )
  })

  it('filters only errors matching the pack own patterns', () => {
    const errors = [
      'Failed to load resource: the server responded with a status of 404 () http://host/000_custom_node_probe.png',
      'Failed to load resource: the server responded with a status of 404 () http://host/000_custom_node_probe.wav',
      'Failed to load resource: the server responded with a status of 404 () http://host/001_custom_node_probe.wav',
      'TypeError: something real broke'
    ]
    expect(unallowlistedErrors('ComfyUI-Impact-Pack', errors)).toEqual([
      'TypeError: something real broke'
    ])
  })

  it('a pattern never filters for a pack that does not own it', () => {
    const error = "Cannot use 'in' operator to search for 'content' in null"
    expect(unallowlistedErrors('ComfyUI-Impact-Pack', [error])).toEqual([error])
    expect(unallowlistedErrors('ComfyUI-Custom-Scripts', [error])).toEqual([])
  })

  it('matches the pack key case-insensitively', () => {
    const errors = [
      'Failed to load resource: the server responded with a status of 404 () http://host/example.png',
      'TypeError: something real broke'
    ]
    expect(unallowlistedErrors('comfyui-impact-pack', errors)).toEqual([
      'TypeError: something real broke'
    ])
  })

  it('unknown pack fails open: every error surfaces', () => {
    // The first error would match an Impact pattern; with no ledger for the
    // pack, nothing may be filtered.
    const errors = [
      'Failed to load resource: the server responded with a status of 404 () http://host/example.png',
      'boom'
    ]
    expect(unallowlistedErrors('Some-Future-Pack', errors)).toEqual(errors)
  })

  it('matches only the observed bare-backend resource requests', () => {
    const cases = [
      [
        'ComfyUI-UltraShape1',
        'Failed to load resource: 404 [http://localhost:8188/api/view?type=input&filename=%28upload+a+mesh+file%29&subfolder=&rand=0.5]'
      ],
      [
        'WhatDreamsCost-ComfyUI',
        'Failed to load resource: 404 [http://localhost:8188/api/view?filename=_cn&type=input]'
      ],
      [
        'comfyui-impact-pack',
        'Failed to load resource: 404 [http://localhost:8188/beach.jpg]'
      ]
    ] as const
    for (const [pack, error] of cases) {
      expect(unallowlistedErrors(pack, [error])).toEqual([])
      expect(unallowlistedErrors('Some-Future-Pack', [error])).toEqual([error])
    }
  })

  it('attributes iTools no-saved-drawing log only to an installed iTools pack', () => {
    const paintFileLog =
      'Error: File not found [http://localhost:8188/extensions/comfyui-itools/makadi/SmartPaintArea.js]'
    expect(unallowlistedErrors('comfyui-itools', [paintFileLog])).toEqual([])
    expect(unallowlistedErrors('Some-Future-Pack', [paintFileLog])).toEqual([
      paintFileLog
    ])
    expect(
      unallowlistedGlobalExtensionErrorsForPacks(
        ['comfyui-itools'],
        [paintFileLog]
      )
    ).toEqual([])
  })

  it('cross-pack variant filters only via packs in scope', () => {
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

  it('filters the conditional KJ and VHS connectivity errors', () => {
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
    ).toEqual([])
    expect(consoleErrorExclusionsForPacks(['ComfyUI-KJNodes'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label:
            'ComfyUI-KJNodes connectivity console kj-points-empty-bbox-json',
          mode: 'conditional-console',
          scope: 'S4 connectivity sweep',
          tier: 'S8'
        })
      ])
    )
  })

  it('requires the exact LTX sparse-editor initialization failure', () => {
    const ltx =
      "Uncaught page error: TypeError: Cannot read properties of null (reading 'imgH')\n" +
      '    at widget.computeSize (http://localhost:8188/extensions/ComfyUI-LTXVideo/js/sparse_track_editor.js:224:29)'
    expect(
      unallowlistedConnectivityErrorsForPacks(['ComfyUI-LTXVideo'], [ltx])
    ).toEqual([])
    expect(
      unallowlistedConnectivityErrorsForPacks(['Some-Future-Pack'], [ltx])
    ).toEqual([ltx])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(['ComfyUI-LTXVideo'], [ltx])
    ).toEqual([])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(['ComfyUI-LTXVideo'], [])
    ).toEqual(['ltx-sparse-track-null-image-size'])
  })

  it('matches lower-cased VHS paths', () => {
    const vhs =
      "TypeError: Cannot read properties of undefined (reading 'target_id')\n" +
      'at get_links (http://localhost:8188/extensions/comfyui-videohelpersuite/js/VHS.core.js:2088:71)'
    expect(
      unallowlistedConnectivityErrorsForPacks(
        ['comfyui-videohelpersuite'],
        [vhs]
      )
    ).toEqual([])
    expect(
      staleRequiredConnectivityErrorRulesForPacks(
        ['comfyui-videohelpersuite'],
        [vhs]
      )
    ).toEqual([])
  })

  it('allows only the exact pysssss None-default 404 without requiring it', () => {
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
describe('isForeignExecutionNoise', () => {
  it('matches the execution-domain console surfaces', () => {
    expect(isForeignExecutionNoise('PromptExecutionError: boom')).toBe(true)
    expect(isForeignExecutionNoise('Prompt execution failed')).toBe(true)
    expect(
      isForeignExecutionNoise(
        'Failed to load resource: the server responded with a status of 400 (Bad Request) http://127.0.0.1:8288/api/prompt'
      )
    ).toBe(true)
  })

  it('does not match render or unrelated resource errors a tier must catch', () => {
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

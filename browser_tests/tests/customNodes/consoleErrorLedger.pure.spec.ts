import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  isForeignExecutionNoise,
  staleRequiredConnectivityErrorRulesForPacks,
  staleRequiredRoundtripErrorRules,
  unallowlistedErrors,
  unallowlistedConnectivityErrorsForPacks,
  unallowlistedErrorsForPacks
} from '@e2e/fixtures/customNode/consoleErrorLedger'

// unallowlistedErrors is the sole enforcement point of the curated load and
// run console gates (customNode.regression.spec.ts T0 and T1): a degradation
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

  test('matches the pack key case-insensitively: cloud installs it lower-cased', () => {
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

  test('cloud environment noise is ledgered for every pack, and only on cloud', () => {
    const viewError =
      'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:4173/api/view?type=input&filename=beach.jpg&subfolder=]'
    const challengeError =
      'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:4173/cdn-cgi/challenge-platform/scripts/jsd/main.js]'
    const real = 'TypeError: something real broke'
    const errors = [viewError, challengeError, real]
    expect(unallowlistedErrors('radiance', errors)).toEqual(errors)
    const previous = process.env.CUSTOM_NODES_ENV
    process.env.CUSTOM_NODES_ENV = 'cloud'
    try {
      expect(unallowlistedErrors('radiance', errors)).toEqual([real])
      // The sweep variant applies them with no pack in scope too.
      expect(unallowlistedErrorsForPacks([], errors)).toEqual([real])
      // Query order is the backend's choice; the rule cannot depend on it.
      expect(
        unallowlistedErrors('any-pack', [
          viewError.replace(
            'type=input&filename=beach.jpg',
            'filename=beach.jpg&type=input'
          )
        ])
      ).toEqual([])
      // Scoped to the 404: a served-but-failing /api/view still reds.
      expect(
        unallowlistedErrors('any-pack', [viewError.replace('404', '500')])
      ).toHaveLength(1)

      const vhsAudio =
        'Failed to load resource: the server responded with a status of 400 (Bad Request) [http://localhost:4173/api/vhs/viewaudio?start_time=0&duration=0&timestamp=1785975998595&deadline=realtime]'
      const vhsVideo =
        'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:4173/api/vhs/viewvideo?filename=bedroom.mp4&type=input]'
      expect(
        unallowlistedErrors('any-pack', [
          vhsAudio,
          vhsVideo,
          vhsVideo.replace(
            'filename=bedroom.mp4&type=input',
            'type=input&filename=bedroom.mp4'
          )
        ])
      ).toEqual([])
      expect(
        unallowlistedErrors('any-pack', [
          vhsAudio.replace('400', '500'),
          vhsVideo.replace('404', '500'),
          vhsVideo.replace('&type=input', ''),
          vhsVideo.replace('type=input', 'type=output'),
          vhsVideo.replace(
            'filename=bedroom.mp4&type=input',
            'notfilename=bedroom.mp4&prototype=input'
          ),
          vhsVideo.replace('type=input', 'type=input-archive'),
          vhsVideo.replace('filename=bedroom.mp4', 'filename='),
          vhsAudio.replace('duration=0', 'duration=0.5'),
          vhsAudio.replace(
            'start_time=0&duration=0',
            'filename=song.wav&duration=0&start_time=0'
          )
        ])
      ).toHaveLength(9)
    } finally {
      if (previous === undefined) delete process.env.CUSTOM_NODES_ENV
      else process.env.CUSTOM_NODES_ENV = previous
    }
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

  test('VHS getpath failures require Cloud, the owning pack, and the exact endpoint or source stack', () => {
    const getpath404 =
      'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:4173/api/vhs/getpath?path=output%2F]'
    const vhsTypeError =
      'Uncaught page error: TypeError: options.filter is not a function\n    at fetch_files (http://localhost:4173/extensions/comfyui-videohelpersuite/js/VHS.core.js:2131:39)'
    const unrelatedTypeError =
      'Uncaught page error: TypeError: options.filter is not a function\n    at other (http://localhost:4173/extensions/other-pack/main.js:1:1)'
    const pathSuffix = getpath404.replace('output%2F]', 'output%2Fmissing.mp4]')
    const extraQuery = getpath404.replace('output%2F]', 'output%2F&other=1]')
    const caseMutation = getpath404.replace(
      '/api/vhs/getpath?path=output%2F',
      '/API/VHS/GETPATH?PATH=OUTPUT%2f'
    )

    expect(
      unallowlistedErrors('ComfyUI-VideoHelperSuite', [
        getpath404,
        vhsTypeError,
        unrelatedTypeError
      ])
    ).toEqual([getpath404, vhsTypeError, unrelatedTypeError])

    const previous = process.env.CUSTOM_NODES_ENV
    process.env.CUSTOM_NODES_ENV = 'cloud'
    try {
      expect(
        unallowlistedErrors('ComfyUI-VideoHelperSuite', [
          getpath404,
          vhsTypeError,
          unrelatedTypeError,
          pathSuffix,
          extraQuery,
          caseMutation
        ])
      ).toEqual([unrelatedTypeError, pathSuffix, extraQuery, caseMutation])
      expect(
        unallowlistedErrors('another-pack', [getpath404, vhsTypeError])
      ).toEqual([getpath404, vhsTypeError])
      expect(
        staleRequiredRoundtripErrorRules('ComfyUI-VideoHelperSuite', [])
      ).toEqual([
        'cloud-vhs-getpath-output-directory',
        'cloud-vhs-getpath-non-array-response'
      ])
      expect(
        staleRequiredRoundtripErrorRules('ComfyUI-VideoHelperSuite', [
          getpath404
        ])
      ).toEqual(['cloud-vhs-getpath-non-array-response'])
      expect(
        staleRequiredRoundtripErrorRules('ComfyUI-VideoHelperSuite', [
          vhsTypeError
        ])
      ).toEqual(['cloud-vhs-getpath-output-directory'])
      expect(
        staleRequiredRoundtripErrorRules('ComfyUI-VideoHelperSuite', [
          getpath404,
          vhsTypeError
        ])
      ).toEqual([])
    } finally {
      if (previous === undefined) delete process.env.CUSTOM_NODES_ENV
      else process.env.CUSTOM_NODES_ENV = previous
    }
  })

  test('connectivity mechanisms are pack-scoped, environment-scoped, and required', () => {
    const points =
      'Error parsing stored points: SyntaxError: Unexpected end of JSON input\n    at new PointsEditor (http://localhost/extensions/ComfyUI-KJNodes/js/editors/point_editor_canvas.js:77:26)'
    const vhs =
      "Uncaught page error: TypeError: Cannot read properties of undefined (reading 'target_id')\n    at get_links (http://localhost/extensions/ComfyUI-VideoHelperSuite/js/VHS.core.js:2096:71)"
    const spline =
      "Error creating SplineEditor: TypeError: Cannot read properties of undefined (reading 'x')\n    at Object.buildPathD (http://localhost/extensions/ComfyUI-KJNodes/js/editors/interpolation.js:132:27)"
    const ltx =
      "Uncaught page error: TypeError: Cannot read properties of null (reading 'imgH')\n    at widget.computeSize (http://localhost/extensions/ComfyUI-LTXVideo/js/sparse_track_editor.js:224:29)"
    const radiance =
      '[Radiance] WebGL context lost - renderer paused. Waiting for recovery... [http://localhost/extensions/radiance/radiance_webgl.js?v=2.3.2]'
    const previous = process.env.CUSTOM_NODES_ENV
    try {
      process.env.CUSTOM_NODES_ENV = 'core'
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
      ).toEqual([
        'kj-points-empty-bbox-json',
        'core-vhs-removed-link-target-id'
      ])

      process.env.CUSTOM_NODES_ENV = 'cloud'
      const packs = ['ComfyUI-KJNodes', 'ComfyUI-LTXVideo', 'radiance']
      expect(
        unallowlistedConnectivityErrorsForPacks(packs, [
          points,
          spline,
          ltx,
          radiance,
          vhs
        ])
      ).toEqual([vhs])
      expect(
        staleRequiredConnectivityErrorRulesForPacks(packs, [
          points,
          spline,
          ltx,
          radiance
        ])
      ).toEqual([])
      expect(
        unallowlistedConnectivityErrorsForPacks(['radiance'], [points])
      ).toEqual([points])
    } finally {
      if (previous === undefined) delete process.env.CUSTOM_NODES_ENV
      else process.env.CUSTOM_NODES_ENV = previous
    }
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

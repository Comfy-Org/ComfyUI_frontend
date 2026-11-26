import { describe, expect, it } from 'vitest'

import { perExtensionLoadReports } from '@e2e/fixtures/utils/consoleErrorCollector'

describe('perExtensionLoadReports', () => {
  it('splits the extension load report into one error per extension with its cause', () => {
    expect(
      perExtensionLoadReports(
        "[Reported error]: error_loading_extension AggregateError: Error loading extensions\n    at reportExtensionLoadFailures (http://localhost:8188/assets/main-abc.js:1:1)\nFailed extensions: /extensions/WhatDreamsCost-ComfyUI/ltx_director_guide.js, /extensions/My Pack, v2/widget.js\nFailed extension: /extensions/WhatDreamsCost-ComfyUI/ltx_director_guide.js: Unexpected token '}'\nFailed extension: /extensions/My Pack, v2/widget.js: Unexpected end of input"
      )
    ).toEqual([
      "[Reported error]: error_loading_extension /extensions/WhatDreamsCost-ComfyUI/ltx_director_guide.js: Unexpected token '}'",
      '[Reported error]: error_loading_extension /extensions/My Pack, v2/widget.js: Unexpected end of input'
    ])
  })

  it('keeps a report without per-extension lines whole', () => {
    const report =
      '[Reported error]: error_loading_extension AggregateError: Error loading extensions'

    expect(perExtensionLoadReports(report)).toEqual([report])
  })
})

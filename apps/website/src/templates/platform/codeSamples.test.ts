import { describe, expect, it } from 'vitest'

import type { CodeSegment } from './codeTokens'
import { routerCodeTabs } from './codeSamples'

function resolve(segments: CodeSegment[], provider: number): string {
  return segments
    .map((segment) =>
      typeof segment === 'string' ? segment : segment.values[provider]
    )
    .join('')
}

describe('routerCodeTabs', () => {
  it('runs on Comfy by default and names only alternate providers', () => {
    for (const tab of Object.values(routerCodeTabs)) {
      expect(resolve(tab.segments, 0)).not.toMatch(/provider/i)
    }
  })

  it.for([
    { tab: 'curl', index: 1, expected: '?model_provider=fal"' },
    { tab: 'python', index: 2, expected: 'model_provider="runware",' },
    { tab: 'typescript', index: 3, expected: "{ modelProvider: 'wavespeed' }" }
  ])('selects $expected in the $tab sample', ({ tab, index, expected }) => {
    expect(resolve(routerCodeTabs[tab].segments, index)).toContain(expected)
  })

  it('copies as a working Router request', () => {
    expect(resolve(routerCodeTabs.curl.segments, 1)).toBe(
      'curl -X POST "https://api.comfy.org/v2/models/openai/gpt-image-2?model_provider=fal" \\\n' +
        '  -H "X-API-Key: $COMFY_API_KEY" \\\n' +
        '  -H "Content-Type: application/json" \\\n' +
        '  -H "Idempotency-Key: $(uuidgen)" \\\n' +
        '  -d \'{"prompt": "aerial view of a neon coral reef at dusk"}\''
    )
    expect(resolve(routerCodeTabs.typescript.segments, 0)).toContain(
      "import { comfy } from '@comfyorg/sdk'"
    )
  })
})

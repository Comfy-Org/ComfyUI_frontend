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
  it('cycles every supported provider in each language sample', () => {
    const providers = ['comfy', 'fal', 'runware', 'wavespeed']

    for (const tab of Object.values(routerCodeTabs)) {
      const providerSegment = tab.segments.find(
        (segment) => typeof segment !== 'string' && segment.highlight
      )

      expect(providerSegment).toEqual({ values: providers, highlight: true })
      expect(tab.lang).toBeDefined()
    }
  })

  it('copies as a working Router request for the chosen provider', () => {
    expect(resolve(routerCodeTabs.curl.segments, 1)).toBe(
      'curl -X POST "https://api.comfy.org/v2/models/openai/gpt-image-2?model_provider=fal" \\\n' +
        '  -H "X-API-Key: $COMFY_API_KEY" \\\n' +
        '  -H "Content-Type: application/json" \\\n' +
        '  -H "Idempotency-Key: $(uuidgen)" \\\n' +
        '  -d \'{"prompt": "aerial view of a neon coral reef at dusk"}\''
    )
    expect(resolve(routerCodeTabs.python.segments, 2)).toContain(
      'provider="runware"'
    )
  })
})

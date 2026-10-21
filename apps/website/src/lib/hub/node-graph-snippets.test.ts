import { describe, expect, it } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'

import { nodeGraphSnippet } from './node-graph-snippets'

describe('nodeGraphSnippet', () => {
  it.for([
    { language: 'curl', calls: '/api/prompt' },
    { language: 'python', calls: 'comfy-sdk==0.4.0' },
    { language: 'typescript', calls: '@comfyorg/sdk@0.4.0' }
  ] as const)(
    '$language reads the exported graph and calls $calls',
    ({ language, calls }) => {
      const code = nodeGraphSnippet(language)

      expect([
        code.includes('workflow_api.json'),
        code.includes(WORKSHOP_CLOUD_BASE_URL),
        code.includes(calls),
        code.includes('COMFY_API_KEY')
      ]).toEqual([true, true, true, true])
    }
  )
})

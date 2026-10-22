import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'

import ServerlessJsonApiGpuAnimation from './ServerlessJsonApiGpuAnimation.vue'

describe('ServerlessJsonApiGpuAnimation', () => {
  it.for([false, true])(
    'starts loading before client hydration with compact=%s',
    async (compact) => {
      const html = await renderToString(
        createSSRApp(ServerlessJsonApiGpuAnimation, { compact })
      )
      const document = new DOMParser().parseFromString(html, 'text/html')
      const frame = document.querySelector('iframe')

      expect(frame).not.toBeNull()
      expect(frame?.getAttribute('src')).toContain(
        '/assets/platform/serverless/json-api-gpu-animation.html'
      )
      expect(frame?.getAttribute('loading')).toBe('eager')
    }
  )
})

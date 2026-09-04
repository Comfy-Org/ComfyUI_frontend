import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { ComfyExtension } from '@/types/comfy'

import { shouldLoadExtension, useExtensionService } from './extensionService'

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, true)).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, false)).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})

describe('registerExtension', () => {
  it('does not re-run registration side effects for a duplicate name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const extension: ComfyExtension = {
        name: 'dup.ext',
        bottomPanelTabs: [
          {
            id: 'dup.tab',
            title: 'Dup',
            type: 'vue',
            component: defineComponent({ render: () => null })
          }
        ]
      }

      const extensionService = useExtensionService()
      extensionService.registerExtension(extension)
      extensionService.registerExtension(extension)

      const bottomPanelStore = useBottomPanelStore()
      expect(bottomPanelStore.panels.terminal.tabs).toHaveLength(1)
    } finally {
      warnSpy.mockRestore()
    }
  })
})

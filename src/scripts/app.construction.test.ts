import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { ComfyApp, attachLegacyUI } from '@/scripts/app'

const bodyAfterImport = document.body.innerHTML

describe('app and api construction', () => {
  it('builds no DOM when the modules are imported', () => {
    expect(bodyAfterImport).toBe('')
  })

  it('reads the page location and stored client id on first use, not at import', () => {
    window.history.replaceState({}, '', '/mounted/comfy/index.html')
    sessionStorage.setItem('clientId', 'stored-client')

    expect({
      base: api.api_base,
      host: api.api_host,
      initialClientId: api.initialClientId
    }).toEqual({
      base: '/mounted/comfy',
      host: 'localhost:3000',
      initialClientId: 'stored-client'
    })
  })

  it('stops the legacy auto-queue and removes its menu once detached', () => {
    const app = new ComfyApp()
    const queuePrompt = vi.spyOn(app, 'queuePrompt').mockResolvedValue(true)
    const detach = attachLegacyUI(app)
    const { menuContainer } = app.ui
    app.ui.autoQueueEnabled = true
    app.ui.autoQueueMode = 'change'

    api.dispatchCustomEvent('autoQueueGraphChanged')
    detach()
    api.dispatchCustomEvent('autoQueueGraphChanged')

    expect(queuePrompt).toHaveBeenCalledOnce()
    expect(menuContainer.isConnected).toBe(false)
    expect(document.getElementById('comfy-file-input')).toBeNull()
  })
})

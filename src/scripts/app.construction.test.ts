import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { api } from '@/scripts/api'
import { attachLegacyUI } from '@/core/legacyUI/attachLegacyUI'
import { ComfyApp } from '@/scripts/app'

const bodyAfterImport = document.body.innerHTML

describe('app and api construction', () => {
  it('builds no DOM when the modules are imported', () => {
    expect(bodyAfterImport).toBe('')
  })

  it('snapshots the page location and stored client id when captured, not at import', () => {
    window.history.replaceState({}, '', '/mounted/comfy/index.html')
    sessionStorage.setItem('clientId', 'stored-client')
    api.captureLaunchContext()
    window.history.replaceState({}, '', '/routed/elsewhere/page')
    sessionStorage.setItem('clientId', 'later-client')

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

  it('stops the legacy auto-queue, an active menu drag, and removes its menu once detached', () => {
    const app = new ComfyApp()
    const queuePrompt = vi.spyOn(app, 'queuePrompt').mockResolvedValue(true)
    const detach = attachLegacyUI(app)
    onTestFinished(detach)
    const { menuContainer } = app.ui
    app.ui.autoQueueEnabled = true
    app.ui.autoQueueMode = 'change'

    menuContainer
      .querySelector('.drag-handle')
      ?.dispatchEvent(new MouseEvent('mousedown'))
    api.dispatchCustomEvent('autoQueueGraphChanged')
    detach()
    api.dispatchCustomEvent('autoQueueGraphChanged')

    expect(queuePrompt).toHaveBeenCalledOnce()
    expect(menuContainer.isConnected).toBe(false)
    expect(document.onmousemove).toBeNull()
    expect(document.getElementById('comfy-file-input')).toBeNull()
    expect(document.querySelector('.comfy-modal')).toBeNull()
  })

  it('replaces an earlier attachment instead of duplicating the legacy DOM', () => {
    const app = new ComfyApp()
    const detachFirst = attachLegacyUI(app)
    const detachSecond = attachLegacyUI(app)
    onTestFinished(detachSecond)

    detachFirst()

    expect({
      fileInputs: document.querySelectorAll('#comfy-file-input').length,
      modals: document.querySelectorAll('.comfy-modal').length,
      menuAttached: app.ui.menuContainer.isConnected
    }).toEqual({ fileInputs: 1, modals: 2, menuAttached: true })
  })
})

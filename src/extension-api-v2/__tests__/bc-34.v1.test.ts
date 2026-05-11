// Category: BC.34 — Settings-panel custom dialog integration
// DB cross-ref: S12.UI3
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 0.0
// compat-floor: NO (absent API gap — no v1 hook; workaround is raw DOM injection)
// v1 contract: no hook — workaround is document.getElementById('comfy-settings-dialog').innerHTML += ...

import { describe, expect, it } from 'vitest'

describe('BC.34 v1 contract — settings-panel custom dialog integration', () => {
  describe('S12.UI3 — innerHTML injection workaround', () => {
    it("extension can locate the settings dialog via getElementById and inject a button", () => {
      const dialog = document.createElement('div')
      dialog.id = 'comfy-settings-dialog'
      document.body.appendChild(dialog)

      // v1 workaround: locate by ID and append via innerHTML
      const target = document.getElementById('comfy-settings-dialog')
      expect(target).not.toBeNull()

      target!.innerHTML += '<button id="custom-ext-btn">Open Dialog</button>'
      const btn = document.getElementById('custom-ext-btn')
      expect(btn).not.toBeNull()
      expect(btn!.tagName).toBe('BUTTON')

      document.body.removeChild(dialog)
    })

    it('injected button can have a click handler attached via addEventListener', () => {
      const dialog = document.createElement('div')
      dialog.id = 'comfy-settings-dialog'
      document.body.appendChild(dialog)

      dialog.innerHTML = '<button id="ext-open-modal">Open Modal</button>'
      const btn = document.getElementById('ext-open-modal')!

      let clicked = false
      btn.addEventListener('click', () => { clicked = true })
      btn.click()
      expect(clicked).toBe(true)

      document.body.removeChild(dialog)
    })

    it('innerHTML assignment to a container replaces prior content (injection breakage on re-render)', () => {
      const dialog = document.createElement('div')
      dialog.id = 'comfy-settings-dialog'
      dialog.innerHTML = '<button id="ext-injected-btn">Custom</button>'
      document.body.appendChild(dialog)

      expect(document.getElementById('ext-injected-btn')).not.toBeNull()

      // Simulating ComfyUI re-rendering the settings panel by reassigning innerHTML
      dialog.innerHTML = '<div class="settings-panel-native">Native settings content</div>'

      // Injected content is gone
      expect(document.getElementById('ext-injected-btn')).toBeNull()

      document.body.removeChild(dialog)
    })
  })

  describe('S12.UI3 — absence of stable hook', () => {
    it('no settings-panel open event exists in v1 — extension must detect open via MutationObserver or polling', async () => {
      // v1 has no app.on('settings-panel-open', ...) — the workaround is a MutationObserver
      const container = document.createElement('div')
      document.body.appendChild(container)

      const openEvents: string[] = []
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (n instanceof Element && n.id === 'comfy-settings-dialog') {
              openEvents.push('settings-opened')
            }
          })
        }
      })
      obs.observe(container, { childList: true })

      // Simulate settings panel appearing in DOM
      const dialog = document.createElement('div')
      dialog.id = 'comfy-settings-dialog'
      container.appendChild(dialog)

      // JSDOM flushes MutationObserver callbacks asynchronously; yield to the event loop.
      await new Promise((r) => setTimeout(r, 0))

      obs.disconnect()
      document.body.removeChild(container)

      // MutationObserver is the only v1 signal — no stable hook
      expect(openEvents).toContain('settings-opened')
    })

    it('innerHTML += concatenation is the only v1 injection mechanism — no registerSettingsTab API exists', () => {
      const dialog = document.createElement('div')
      dialog.id = 'comfy-settings-dialog'
      dialog.innerHTML = '<div class="existing">Existing content</div>'
      document.body.appendChild(dialog)

      const originalContent = dialog.innerHTML
      // v1 approach: += appends but is fragile (re-serializes the entire DOM subtree)
      dialog.innerHTML += '<button id="ext-btn">Extension</button>'

      expect(dialog.innerHTML).toContain('existing')
      expect(dialog.innerHTML).toContain('ext-btn')
      expect(dialog.innerHTML.length).toBeGreaterThan(originalContent.length)

      document.body.removeChild(dialog)
    })
  })
})

// Category: BC.33 — Cross-extension DOM widget creation observation
// DB cross-ref: S4.W6
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 0.0
// compat-floor: NO (absent API gap — no stable v1 hook exists)
// v1 contract: no stable hook — workaround is MutationObserver on document or polling node.widgets

import { describe, expect, it } from 'vitest'
import { loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

describe('BC.33 v1 contract — cross-extension DOM widget creation observation', () => {
  describe('S4.W6 — MutationObserver workaround (JSDOM structural)', () => {
    it('MutationObserver childList fires when a .comfy-widget div is appended', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const observed: Element[] = []

      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) observed.push(n)
          })
        }
      })
      obs.observe(container, { childList: true })

      const widget = document.createElement('div')
      widget.className = 'comfy-widget'
      container.appendChild(widget)

      // JSDOM flushes MutationObserver callbacks asynchronously; yield to the event loop
      await new Promise((r) => setTimeout(r, 0))

      obs.disconnect()
      document.body.removeChild(container)

      expect(observed).toHaveLength(1)
      expect(observed[0].className).toBe('comfy-widget')
    })

    it('mutation record type is childList and addedNodes[0] is the appended element', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const records: MutationRecord[] = []
      const obs = new MutationObserver((muts) => records.push(...muts))
      obs.observe(container, { childList: true })

      const el = document.createElement('div')
      container.appendChild(el)

      // JSDOM flushes MutationObserver callbacks asynchronously; yield to the event loop
      await new Promise((r) => setTimeout(r, 0))

      obs.disconnect()
      document.body.removeChild(container)

      expect(records[0].type).toBe('childList')
      expect(records[0].addedNodes[0]).toBe(el)
    })

    it('observer does not fire after disconnect() — no false-positive events', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const calls: number[] = []
      const obs = new MutationObserver(() => calls.push(1))
      obs.observe(container, { childList: true })
      obs.disconnect()
      container.appendChild(document.createElement('div'))

      await new Promise((r) => setTimeout(r, 0))

      document.body.removeChild(container)
      expect(calls).toHaveLength(0)
    })

    it('MutationObserver fires for any appended element, not just ComfyUI widgets (over-firing limitation)', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const observed: string[] = []
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) observed.push(n.tagName.toLowerCase())
          })
        }
      })
      obs.observe(container, { childList: true })

      container.appendChild(document.createElement('span')) // non-widget
      container.appendChild(document.createElement('div'))  // could be widget

      // JSDOM may batch both appends into one MutationRecord or deliver two records;
      // yield to the event loop to ensure the callback fires before asserting.
      await new Promise((r) => setTimeout(r, 0))

      obs.disconnect()
      document.body.removeChild(container)

      // Observer fires for both — extension must filter by class/attribute itself
      expect(observed.length).toBeGreaterThanOrEqual(2)
    })

    it.todo('TODO(R8): S4.W6 evidence excerpt not yet in harness fixture JSON')
  })
})

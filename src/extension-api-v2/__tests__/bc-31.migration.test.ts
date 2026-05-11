// Category: BC.31 — DOM injection and style management
// DB cross-ref: S16.DOM1, S16.DOM2, S16.DOM3, S16.DOM4
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/help_popup.js
// Migration: v1 raw DOM injection → v2 injectStyles / addPanel / addToolbarItem / renderMarkdownToHtml

import { describe, it, expect } from 'vitest'
import { expectTypeOf } from 'vitest'
import type {
  ExtensionManager,
  SidebarTabExtension,
  BottomPanelExtension,
  CustomExtension
} from '@/extension-api/shell'

describe('BC.31 migration — DOM injection and style management', () => {
  describe('S16.DOM3 → renderMarkdownToHtml: safe HTML path (designed)', () => {
    it('renderMarkdownToHtml is the designed v2 replacement for raw innerHTML (S16.DOM3)', () => {
      // Type-level: the method exists and returns string — usable with innerHTML safely.
      type RenderFn = ExtensionManager['renderMarkdownToHtml']
      expectTypeOf<RenderFn>().toBeFunction()
      type RetType = ReturnType<RenderFn>
      expectTypeOf<RetType>().toEqualTypeOf<string>()
    })

    it('renderMarkdownToHtml accepts an optional baseUrl for relative media paths', () => {
      type P1 = Parameters<ExtensionManager['renderMarkdownToHtml']>[1]
      // Optional: must accept string or undefined
      type AcceptsUndefined = undefined extends P1 ? true : false
      const ok: AcceptsUndefined = true
      expect(ok).toBe(true)
    })
  })

  describe('S16.DOM2 → CustomExtension.render: managed container injection (designed)', () => {
    it('CustomExtension.render(container) is the v2 replacement for document.body.appendChild (S16.DOM2)', () => {
      type RenderFn = CustomExtension['render']
      // v2 passes the managed container — no direct body access needed.
      expectTypeOf<RenderFn>().parameter(0).toEqualTypeOf<HTMLElement>()
    })

    it('CustomExtension.destroy() is optional — v2 handles teardown automatically when present', () => {
      type DestroyFn = CustomExtension['destroy']
      type IsOptional = DestroyFn extends (() => void) | undefined ? true : false
      const ok: IsOptional = true
      expect(ok).toBe(true)
    })

    it('SidebarTabExtension and BottomPanelExtension both accept CustomExtension (render) shape', () => {
      // Confirms the CustomExtension injection path works for both major panel types.
      type SidebarCustom = Extract<SidebarTabExtension, { type: 'custom' }>
      type PanelCustom = Extract<BottomPanelExtension, { type: 'custom' }>
      type SidebarHasRender = 'render' extends keyof SidebarCustom ? true : false
      type PanelHasRender = 'render' extends keyof PanelCustom ? true : false
      const sr: SidebarHasRender = true
      const pr: PanelHasRender = true
      expect(sr).toBe(true)
      expect(pr).toBe(true)
    })
  })

  describe('JSDOM: cleanup responsibility — v1 manual vs v2 managed', () => {
    it('JSDOM baseline: v1 style injection leaves element in document.head unless manually removed', () => {
      const styleEl = document.createElement('style')
      styleEl.id = 'bc31-migration-v1-style'
      styleEl.textContent = '.v1-style { color: blue; }'
      document.head.appendChild(styleEl)

      // v1: element persists — no cleanup on scope disposal
      expect(document.getElementById('bc31-migration-v1-style')).not.toBeNull()

      // The test itself must clean up (mirrors v1 behaviour where extension was responsible)
      document.head.removeChild(styleEl)
      expect(document.getElementById('bc31-migration-v1-style')).toBeNull()
    })

    it('JSDOM baseline: v1 panel injection leaves element in document.body unless manually removed', () => {
      const panelEl = document.createElement('div')
      panelEl.id = 'bc31-migration-v1-panel'
      document.body.appendChild(panelEl)

      expect(document.getElementById('bc31-migration-v1-panel')).not.toBeNull()

      // Cleanup mirrors v1 manual teardown responsibility
      document.body.removeChild(panelEl)
      expect(document.getElementById('bc31-migration-v1-panel')).toBeNull()
    })
  })

  describe('S16.DOM1 → injectStyles (proposed API, migration contract)', () => {
    it.todo(
      // TODO(API design): injectStyles not yet on ExtensionManager
      'v1 document.head.appendChild(styleEl) and v2 injectStyles(css) both result in equivalent CSS applied to document'
    )
    it.todo(
      // TODO(Phase B + JSDOM): requires live ExtensionManager with scope tracking
      'v2 injectStyles() produces styles with equal or narrower specificity than v1 raw injection'
    )
    it.todo(
      // TODO(Phase B): requires extension unregister lifecycle
      'v1 style/panel injections persist after extension unregisters (no cleanup); v2 injections are removed'
    )
    it.todo(
      // TODO(Phase B): requires multiple extension scopes
      'v2 cleanup on unregister does not affect styles/panels from other extensions'
    )
  })
})

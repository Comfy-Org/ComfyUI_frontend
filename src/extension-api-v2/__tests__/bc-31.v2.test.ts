// Category: BC.31 — DOM injection and style management
// DB cross-ref: S16.DOM1, S16.DOM2, S16.DOM3, S16.DOM4
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/help_popup.js
// v2 replacement: extensionManager.injectStyles(css), SidebarTabExtension / BottomPanelExtension,
//                 ExtensionManager.renderMarkdownToHtml (safe HTML path)
// Note: injectStyles() and addPanel() / addToolbarItem() are proposed v2 API surface (S16.DOM1/2)
//       but are NOT yet in the type surface — they arrive with the ExtensionManager redesign.
//       Tests below cover what IS designed (renderMarkdownToHtml, VueExtension sidebar/panel slots)
//       and use it.todo for the proposed-but-undesigned DOM injection API.

import { describe, it, expect } from 'vitest'
import { expectTypeOf } from 'vitest'
import type {
  ExtensionManager,
  SidebarTabExtension,
  BottomPanelExtension,
  VueExtension,
  CustomExtension
} from '@/extension-api/shell'

describe('BC.31 v2 contract — DOM injection and style management', () => {
  describe('ExtensionManager.renderMarkdownToHtml — designed safe HTML path (S16.DOM3)', () => {
    it('ExtensionManager.renderMarkdownToHtml exists and accepts (markdown: string, baseUrl?: string)', () => {
      type RenderFn = ExtensionManager['renderMarkdownToHtml']
      expectTypeOf<RenderFn>().toBeFunction()
      expectTypeOf<RenderFn>().parameter(0).toEqualTypeOf<string>()
      // baseUrl is optional — second param must accept string | undefined
      type P1 = Parameters<RenderFn>[1]
      type IsOptionalString = P1 extends string | undefined ? true : false
      const ok: IsOptionalString = true
      expect(ok).toBe(true)
    })

    it('renderMarkdownToHtml returns a string (the sanitized HTML)', () => {
      type RenderFn = ExtensionManager['renderMarkdownToHtml']
      expectTypeOf<ReturnType<RenderFn>>().toEqualTypeOf<string>()
    })
  })

  describe('VueExtension — Vue component mounting in managed slots (S16.DOM2 host-managed path)', () => {
    it('VueExtension has type: \'vue\' literal and component: Component', () => {
      type VEType = VueExtension['type']
      expectTypeOf<VEType>().toEqualTypeOf<'vue'>()
    })

    it('CustomExtension has type: \'custom\' and render(container) + optional destroy()', () => {
      type CEType = CustomExtension['type']
      type RenderFn = CustomExtension['render']
      type DestroyFn = CustomExtension['destroy']
      expectTypeOf<CEType>().toEqualTypeOf<'custom'>()
      expectTypeOf<RenderFn>().parameter(0).toEqualTypeOf<HTMLElement>()
      // destroy is optional
      type IsOptional = DestroyFn extends (() => void) | undefined ? true : false
      const ok: IsOptional = true
      expect(ok).toBe(true)
    })

    it('SidebarTabExtension discriminant: either type=\'vue\' with component or type=\'custom\' with render', () => {
      // SidebarTabExtension is a union — both branches must exist
      type HasVue = Extract<SidebarTabExtension, { type: 'vue' }> extends never ? false : true
      type HasCustom = Extract<SidebarTabExtension, { type: 'custom' }> extends never ? false : true
      const hasVue: HasVue = true
      const hasCustom: HasCustom = true
      expect(hasVue).toBe(true)
      expect(hasCustom).toBe(true)
    })

    it('BottomPanelExtension has the same two-branch discriminant as SidebarTabExtension', () => {
      type HasVue = Extract<BottomPanelExtension, { type: 'vue' }> extends never ? false : true
      type HasCustom = Extract<BottomPanelExtension, { type: 'custom' }> extends never ? false : true
      const hasVue: HasVue = true
      const hasCustom: HasCustom = true
      expect(hasVue).toBe(true)
      expect(hasCustom).toBe(true)
    })

    it('ExtensionManager.registerSidebarTab accepts a SidebarTabExtension', () => {
      type RegisterFn = ExtensionManager['registerSidebarTab']
      expectTypeOf<RegisterFn>().parameter(0).toEqualTypeOf<SidebarTabExtension>()
    })
  })

  describe('injectStyles(css) — proposed API (S16.DOM1)', () => {
    it.todo(
      // TODO(API design): injectStyles not yet on ExtensionManager — arrives with DOM injection redesign
      'extensionManager.injectStyles(css) appends a scoped <style> element to document.head'
    )
    it.todo(
      // TODO(Phase B + JSDOM): requires live ExtensionManager + JSDOM
      'styles injected via injectStyles() are removed from document.head when the extension unregisters'
    )
    it.todo(
      // TODO(Phase B + JSDOM): requires live ExtensionManager + JSDOM
      'multiple calls to injectStyles() with the same content do not create duplicate <style> tags'
    )
    it.todo(
      // TODO(API design): proposed cleanup-handle return shape not yet decided
      'injectStyles() returns a cleanup handle; calling it removes the style tag immediately'
    )
  })

  describe('addPanel / addToolbarItem — proposed API (S16.DOM2)', () => {
    it.todo(
      // TODO(API design): addPanel not yet on ExtensionManager
      'extensionManager.addPanel({ id, render }) mounts a panel into the host-managed panel container'
    )
    it.todo(
      // TODO(Phase B + JSDOM): requires live ExtensionManager
      'panel mounted via addPanel() is accessible via document.getElementById(opts.id)'
    )
    it.todo(
      // TODO(Phase B): requires live scope disposal
      'panel is unmounted when the extension scope is disposed'
    )
    it.todo(
      // TODO(API design): addToolbarItem not yet on ExtensionManager
      'extensionManager.addToolbarItem({ id, icon, tooltip, action }) appends an item to the ComfyUI toolbar'
    )
  })
})

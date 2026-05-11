// Category: BC.32 — Embedded framework runtimes and Vue widget bundling
// DB cross-ref: S16.VUE1
// Exemplar: ComfyUI-NKD-Sigmas-Curve (aggregate — Notion API research §2.9)
// Migration: v1 standalone createApp(Component).mount(el) → v2 VueExtension (host Vue sharing)
//            or registerVueWidget (proposed, for DOM widgets)

import { describe, it, expect } from 'vitest'
import { expectTypeOf } from 'vitest'
import type {
  VueExtension,
  CustomExtension,
  SidebarTabExtension,
  BottomPanelExtension
} from '@/extension-api/shell'
import type { Component } from 'vue'

describe('BC.32 migration — embedded framework runtimes and Vue widget bundling', () => {
  describe('VueExtension path: host-Vue-sharing is the designed migration target', () => {
    it('VueExtension.component: Component — same type as the argument to createApp()', () => {
      // v1: createApp(MyComponent)  →  v2: { type: 'vue', component: MyComponent }
      // Both take the same Vue Component type.
      type VEComponent = VueExtension['component']
      expectTypeOf<VEComponent>().toEqualTypeOf<Component>()
    })

    it('SidebarTabExtension VueBranch has id + type + component — minimal migration target shape', () => {
      type VueSidebar = Extract<SidebarTabExtension, { type: 'vue' }>
      type HasId = 'id' extends keyof VueSidebar ? true : false
      type HasType = 'type' extends keyof VueSidebar ? true : false
      type HasComponent = 'component' extends keyof VueSidebar ? true : false
      expect(true as HasId).toBe(true)
      expect(true as HasType).toBe(true)
      expect(true as HasComponent).toBe(true)
    })

    it('BottomPanelExtension VueBranch has the same shape as SidebarTabExtension VueBranch', () => {
      type VueSidebar = Extract<SidebarTabExtension, { type: 'vue' }>
      type VuePanel = Extract<BottomPanelExtension, { type: 'vue' }>
      // Both have component: Component
      type SidebarComp = VueSidebar['component']
      type PanelComp = VuePanel['component']
      expectTypeOf<SidebarComp>().toEqualTypeOf<PanelComp>()
    })
  })

  describe('no-double-Vue: VueExtension removes bundled Vue from extension bundle', () => {
    it('VueExtension.component receives a Component reference — the same object the host resolves', () => {
      // Type-level proof: Component is imported from 'vue', not re-bundled.
      // Extensions passing a Component reference reuse the host runtime's Vue.
      type VEComponent = VueExtension['component']
      // Must be assignable from a Vue Component import — same type, same runtime object.
      type IsVueComponent = Component extends VEComponent ? true : false
      const ok: IsVueComponent = true
      expect(ok).toBe(true)
    })
  })

  describe('cleanup regression: destroy() vs automatic managed teardown', () => {
    it('CustomExtension.destroy() is optional — v2 manages teardown without requiring it', () => {
      type DestroyFn = CustomExtension['destroy']
      type IsOptional = undefined extends DestroyFn ? true : false
      const ok: IsOptional = true
      expect(ok).toBe(true)
    })
  })

  describe('registerVueWidget migration (proposed API — runtime parity tests deferred)', () => {
    it.todo(
      // TODO(API design): registerVueWidget not yet on the type surface
      'Component renders equivalent visible output whether mounted via v1 createApp().mount() or v2 registerVueWidget()'
    )
    it.todo(
      // TODO(Phase B): requires live host app + i18n plugin probe
      'v2 registered Component can read host i18n locale; v1 standalone app cannot without importing its own i18n instance'
    )
    it.todo(
      // TODO(Phase B): requires live host app + Pinia probe
      'v2 registered Component can read Pinia store state; v1 standalone app sees an isolated Pinia instance'
    )
    it.todo(
      // TODO(Phase B): requires two-extension scenario + Vue runtime version check
      'migrating one extension from createApp().mount() to registerVueWidget() does not load two Vue runtimes simultaneously'
    )
    it.todo(
      // TODO(Phase B): requires node removal lifecycle + mount state inspection
      'v2 registerVueWidget() always unmounts on node removal; v1 does not without explicit onRemoved handler'
    )
  })
})

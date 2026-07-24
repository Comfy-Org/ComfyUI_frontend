/**
 * Reka is the default dialog renderer (#12593), and `GlobalDialog`'s Reka
 * branch binds only the Reka props — a PrimeVue `style`/`pt`/`class` on a Reka
 * dialog is silently dropped and the dialog renders at the default size. The
 * defect shipped twice (#12666) and needed two follow-up fixes (#13092,
 * #13633), so `DialogComponentProps` is discriminated on `renderer` to reject
 * those props at compile time.
 *
 * The `@ts-expect-error` assertions below are the regression net: each one
 * reconstructs a shipped pre-fix prop object, and `pnpm typecheck` fails if the
 * discriminated union stops rejecting it.
 */
import { createTestingPinia } from '@pinia/testing'
import { cleanup, render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import type { DialogComponentProps } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close', maximizeDialog: 'Maximize' } } },
  missingWarn: false,
  fallbackWarn: false
})

const Body = defineComponent({
  name: 'Body',
  setup: () => () => h('p', 'body content')
})

describe('PrimeVue-only props on the Reka renderer', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    cleanup()
  })

  it('are dropped rather than applied', async () => {
    render(GlobalDialog, { global: { plugins: [PrimeVue, i18n] } })

    // Only reachable by defeating the type below; this is the state the type
    // now prevents.
    const deadProps = {
      style: 'width: min(1328px, 95vw)',
      pt: { root: { class: 'legacy-pt-root' } }
    } as unknown as DialogComponentProps

    useDialogStore().showDialog({
      key: 'reka-ignores-primevue-props',
      title: 'Pricing',
      component: Body,
      dialogComponentProps: deadProps
    })

    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('style') ?? '').not.toContain('1328px')
    expect(dialog).not.toHaveClass('legacy-pt-root')
  })

  it('are rejected on an implicit Reka dialog (the #12666 / #13633 shape)', () => {
    // @ts-expect-error `style`/`pt` are PrimeVue-only; with `renderer` omitted
    // the dialog renders with Reka and both are ignored. Use `size` +
    // `contentClass`.
    const prefix13633: DialogComponentProps = {
      style: 'width: min(1328px, 95vw); max-height: 958px;',
      pt: {
        root: { class: 'rounded-2xl bg-transparent h-full' },
        content: { class: '!p-0 rounded-2xl h-full' }
      }
    }

    expect(prefix13633).toBeDefined()
  })

  it('are rejected on an explicit Reka dialog (the #13092 shape)', () => {
    // @ts-expect-error `style`/`pt` are ignored by the Reka renderer.
    const prefix13092: DialogComponentProps = {
      renderer: 'reka',
      style: 'max-width: 95vw; max-height: 90vh;',
      pt: { root: { class: 'rounded-2xl bg-transparent' } }
    }

    expect(prefix13092).toBeDefined()
  })

  it('are rejected when spread in from a shared props object', () => {
    const sharedShellProps = {
      style: 'width: min(1328px, 95vw); max-height: 958px;',
      pt: { root: { class: 'rounded-2xl bg-transparent h-full' } }
    }

    // @ts-expect-error the props are dead however they reach the dialog.
    const spreadPreFix: DialogComponentProps = {
      ...sharedShellProps,
      modal: false
    }

    expect(spreadPreFix).toBeDefined()
  })

  it('accepts the Reka equivalents these fixes landed', () => {
    const fixed: DialogComponentProps = {
      renderer: 'reka',
      size: 'full',
      modal: false,
      contentClass: 'sm:max-w-7xl max-h-[90vh] rounded-2xl',
      overlayClass: 'bg-black/60',
      headerClass: 'p-0',
      bodyClass: 'p-0',
      footerClass: 'p-0'
    }

    expect(fixed.size).toBe('full')
  })

  it('keeps the PrimeVue props available on the legacy renderer', () => {
    const legacy: DialogComponentProps = {
      renderer: 'primevue',
      style: 'width: min(1328px, 95vw)',
      pt: { root: { class: 'rounded-2xl' } },
      position: 'top',
      unstyled: true
    }

    expect(legacy.renderer).toBe('primevue')
  })
})

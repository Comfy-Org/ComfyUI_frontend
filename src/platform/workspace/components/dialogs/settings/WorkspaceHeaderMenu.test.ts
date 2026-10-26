import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'

import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import WorkspaceHeaderMenu from './WorkspaceHeaderMenu.vue'

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

const flags = vi.hoisted(() => ({ unifiedBillingSettingsEnabled: false }))
vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    fromPartial<ReturnType<typeof useFeatureFlags>>({ flags })
}))

const SettingsHeader = defineComponent({
  setup() {
    return () =>
      h('header', { 'data-testid': 'settings-header' }, [
        h('div', { id: 'settings-header-controls' })
      ])
  }
})

function renderInHeader() {
  render(
    defineComponent({
      setup() {
        return () => [h(SettingsHeader), h(WorkspaceHeaderMenu)]
      }
    }),
    {
      global: {
        stubs: {
          WorkspaceMenuButton: {
            props: ['variant'],
            template:
              '<button aria-label="workspace-menu" :data-variant="variant" />'
          }
        }
      }
    }
  )
}

function setMenuInHeader(inHeader: boolean) {
  vi.mocked(useWorkspaceUI()).isWorkspaceMenuInHeader = computed(() => inHeader)
}

describe('WorkspaceHeaderMenu', () => {
  it('puts the workspace menu in the settings header', async () => {
    setMenuInHeader(true)
    renderInHeader()

    expect(
      await within(screen.getByTestId('settings-header')).findByLabelText(
        'workspace-menu'
      )
    ).toBeInTheDocument()
  })

  it('renders nothing while the menu stays in the panel', async () => {
    setMenuInHeader(false)
    renderInHeader()
    await nextTick()

    expect(screen.queryByLabelText('workspace-menu')).not.toBeInTheDocument()
  })

  it('keeps the muted default menu button while unified billing is off', async () => {
    flags.unifiedBillingSettingsEnabled = false
    setMenuInHeader(true)
    renderInHeader()

    expect(await screen.findByLabelText('workspace-menu')).not.toHaveAttribute(
      'data-variant'
    )
  })

  it('uses the text-only menu button while unified billing is on', async () => {
    flags.unifiedBillingSettingsEnabled = true
    setMenuInHeader(true)
    renderInHeader()

    expect(await screen.findByLabelText('workspace-menu')).toHaveAttribute(
      'data-variant',
      'textonly'
    )
  })
})

import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick } from 'vue'

import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import WorkspaceHeaderMenu from './WorkspaceHeaderMenu.vue'

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

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
            template: '<button aria-label="workspace-menu" />'
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
})

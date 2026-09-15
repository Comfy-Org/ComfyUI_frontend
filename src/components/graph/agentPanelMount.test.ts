import { render, screen } from '@testing-library/vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useSettingStore } from '@/platform/settings/settingStore'

import LiteGraphCanvasSplitterOverlay from '../LiteGraphCanvasSplitterOverlay.vue'
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))

beforeEach(() => {
  useSettingStore().settingValues['Comfy.Sidebar.Location'] = 'left'
})

vi.mock<unknown>(import('@/composables/useAppMode'), async () => {
  const { ref } = await import('vue')
  return {
    useAppMode: () => ({
      isSelectMode: ref(false),
      isBuilderMode: ref(false)
    })
  }
})

const slotStub = (testid: string) => `<div data-testid="${testid}" />`

function renderOverlay() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(LiteGraphCanvasSplitterOverlay, {
    global: {
      plugins: [i18n],
      stubs: {
        Splitter: { template: '<div><slot /></div>' },
        SplitterPanel: { template: '<div><slot /></div>' }
      }
    },
    slots: {
      'agent-panel': slotStub('agent-dock'),
      'graph-canvas-panel': slotStub('workspace-content')
    }
  })
}

describe('the graph-side agent panel mount', () => {
  it('renders the agent-panel slot as a sibling of the workspace column, not a descendant', () => {
    renderOverlay()

    const dock = screen.getByTestId('agent-dock')
    const workspace = screen.getByTestId('workspace-content')

    expect(dock.contains(workspace)).toBe(false)
    expect(workspace.contains(dock)).toBe(false)

    // The dock sits directly after the column that carries the workspace, so
    // the flex-row parent lays them out side by side. Sibling order is the
    // behavior under test, which Testing Library queries cannot express.
    // eslint-disable-next-line testing-library/no-node-access
    const column = dock.previousElementSibling
    expect(column?.contains(workspace)).toBe(true)
  })

  it('guards the docked panel against linear mode (GraphCanvas stays mounted there)', () => {
    // Source pin: GraphCanvas cannot mount in the unit environment (it
    // bootstraps the litegraph canvas), and the flag-off agent E2E owns the
    // rendered single-instance property. LinearView mounts its own dock; two
    // at once breaks strict-mode locators.
    const graphCanvasSource = readFileSync(
      join(__dirname, 'GraphCanvas.vue'),
      'utf-8'
    )
    expect(graphCanvasSource).toMatch(
      /<component\s+:is="DockedAgentPanel"\s+v-if="agentDocked && !linearMode"\s*\/>/
    )
  })
})

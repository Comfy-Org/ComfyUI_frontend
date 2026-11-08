import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

import { i18n } from '@/i18n'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

import type { AgentExperience } from '@/workbench/extensions/agent/experiments/chatRedesign'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import type { ConversationEntry } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import AgentPanel from './AgentPanel.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/assets/composables/useMediaAssetActions'))
vi.mock(import('@/workbench/extensions/agent/feedback'))
vi.mock(import('@/composables/auth/useCurrentUser'))

setupInlinePromptEditorDom()

const tabs = [{ path: 'workflows/portrait.json', name: 'portrait' }]

function output(name: string): AssetItem {
  return {
    id: `id-${name}`,
    name,
    tags: ['output'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    preview_url: `/api/view?filename=${name}&type=output`
  }
}

type OutputList = ReturnType<typeof useAssetsStore>['outputAssets']

function seedOutputs(names: string[]): void {
  useAssetsStore().outputAssets = {
    items: names.map(output),
    hasMore: false,
    isLoading: false,
    loadMore: vi.fn(async () => false),
    loadNew: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {})
  } satisfies OutputList
}

function mount(
  experience: AgentExperience,
  {
    canOpenAssets = true,
    entries = []
  }: { canOpenAssets?: boolean; entries?: ConversationEntry[] } = {}
) {
  useAgentPanelStore().experience = experience
  return render(AgentPanel, {
    props: {
      entries,
      canOpenAssets,
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      activeTab: tabs[0],
      workflowTabs: tabs,
      visibleTabPath: tabs[0].path
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    }
  })
}

const outputsToggle = () => screen.getByRole('button', { name: 'Outputs' })
const tray = () => screen.findByRole('region', { name: 'Recent outputs' })

function follows(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  )
}

describe('AgentPanel outputs in the redesign', () => {
  beforeEach(() => {
    localStorage.clear()
    seedOutputs(['image-1.png', 'image-2.png'])
  })

  it('opens the recent outputs under the composer in place of the starter prompts', async () => {
    mount('redesign')

    expect(outputsToggle()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(outputsToggle())

    expect(follows(screen.getByTestId('agent-composer'), await tray())).toBe(
      true
    )
    expect(outputsToggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByTestId('suggested-prompts')).toBeNull()

    await userEvent.click(outputsToggle())

    expect(screen.queryByRole('region', { name: 'Recent outputs' })).toBeNull()
    expect(screen.getByTestId('suggested-prompts')).toBeVisible()
  })

  it('opens the recent outputs under the composer in a conversation', async () => {
    mount('redesign', {
      entries: [
        { id: toTurnId('turn-1'), role: 'user', text: 'Make a fox portrait' }
      ]
    })

    await userEvent.click(outputsToggle())

    expect(follows(screen.getByTestId('agent-composer'), await tray())).toBe(
      true
    )
    expect(screen.queryByText('What do you want to make?')).toBeNull()
  })

  it('adds a ticked output to the message and returns to the composer', async () => {
    mount('redesign')
    await userEvent.click(outputsToggle())
    await tray()

    await userEvent.click(
      screen.getByRole('button', { name: 'Select image-2.png' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Add 1 to conversation' })
    )

    expect(useAgentComposerStore().attachments.map(({ name }) => name)).toEqual(
      ['image-2.png']
    )
    expect(screen.queryByRole('region', { name: 'Recent outputs' })).toBeNull()
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('opens the recent outputs from the add menu without opening the assets panel', async () => {
    const view = mount('redesign')

    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Add from outputs' })
    )

    expect(await tray()).toBeVisible()
    expect(view.emitted().openAssets).toBeUndefined()
  })

  it('has no outputs entry when assets are not available', () => {
    mount('redesign', { canOpenAssets: false })

    expect(screen.queryByRole('button', { name: 'Outputs' })).toBeNull()
  })

  it('keeps sending the classic composer to the assets panel', async () => {
    const view = mount('classic')

    expect(screen.queryByRole('button', { name: 'Outputs' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Drag in asset from asset panel' })
    )

    expect(view.emitted().openAssets).toHaveLength(1)
    expect(screen.queryByRole('region', { name: 'Recent outputs' })).toBeNull()
  })
})

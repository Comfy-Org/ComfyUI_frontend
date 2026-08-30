import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  customNodeEditorStateKey,
  readCustomNodeEditorState,
  updateCustomNodeEditorState
} from '../utils/customNodeEditorState'
import CustomNodeWorkbench from './CustomNodeWorkbench.vue'

const mocks = vi.hoisted(() => ({
  applyAgentProposal: vi.fn(),
  createAgentProposal: vi.fn(),
  replaceFiles: vi.fn(),
  reportError: vi.fn(),
  saveAll: vi.fn()
}))

vi.mock('../composables/useCustomNodeEditor', () => ({
  useCustomNodeEditor: () => ({
    applyAgentProposal: mocks.applyAgentProposal,
    createAgentProposal: mocks.createAgentProposal
  })
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.reportError
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: { light_theme: false }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({ activeWorkspaceId: 'workspace-1' })
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    name: 'Button',
    inheritAttrs: false,
    props: ['disabled', 'loading', 'type'],
    template:
      '<button v-bind="$attrs" :type="type" :disabled="disabled || loading"><slot /></button>'
  }
}))

vi.mock('./CustomNodeTreeEditor.vue', () => ({
  default: {
    name: 'CustomNodeTreeEditor',
    props: ['sessionId', 'stateKey', 'packName'],
    methods: {
      replaceFiles: mocks.replaceFiles,
      saveAll: mocks.saveAll
    },
    template: '<div data-testid="custom-node-tree-editor">checkerboard.py</div>'
  }
}))

vi.mock('./CustomNodeCodeEditor.vue', () => ({
  default: {
    name: 'CustomNodeCodeEditor',
    props: ['path', 'originalContent', 'proposedContent', 'theme'],
    template: `
      <div data-testid="proposal-diff" :data-theme="theme">
        <pre data-testid="original-content">{{ originalContent }}</pre>
        <pre data-testid="proposed-content">{{ proposedContent }}</pre>
      </div>
    `
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      customNodePacks: {
        editor: {
          workbench: {
            toggleAgent: 'Toggle Node Agent'
          },
          agent: {
            title: 'Node Agent',
            close: 'Close Node Agent',
            description: 'Describe the change.',
            placeholder: 'Describe a node change',
            ask: 'Propose changes',
            proposal: 'Proposed changes',
            reviewNotice: 'Review before applying.',
            apply: 'Apply changes',
            dismiss: 'Dismiss',
            failed: 'Proposal failed',
            applyFailed: 'Apply failed',
            unavailable: 'Node Agent unavailable',
            unavailableDetail: 'Server key required',
            safety: 'Node Agent cannot run code or submit.'
          }
        }
      }
    }
  }
})

describe('CustomNodeWorkbench', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.applyAgentProposal.mockReset()
    mocks.createAgentProposal.mockReset()
    mocks.replaceFiles.mockReset().mockResolvedValue(undefined)
    mocks.reportError.mockReset()
    mocks.saveAll.mockReset().mockResolvedValue(undefined)
  })

  it('opens the project editor with the Node Agent visible', () => {
    render(CustomNodeWorkbench, {
      props: {
        sessionId: 'session-1',
        agentEnabled: true,
        packName: 'Checkerboard Mask'
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByTestId('custom-node-tree-editor')).toBeVisible()
    expect(
      screen.getByRole('complementary', { name: 'Node Agent' })
    ).toBeVisible()
    expect(screen.queryByText(/Getting Started/i)).not.toBeInTheDocument()
  })

  it('saves edits before requesting a proposal and applies only after review', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockResolvedValue({
      id: 'proposal-1',
      summary: 'Added a configurable color.',
      changes: [
        {
          path: 'v2/nodes/checkerboard.py',
          originalContent: '# locally edited\n',
          proposedContent: '# agent proposal\n'
        }
      ],
      createdAt: '2026-08-29T12:00:00Z'
    })
    const appliedFiles = {
      files: [
        {
          path: 'v2/nodes/checkerboard.py',
          content: '# agent proposal\n',
          editable: true
        }
      ],
      initialPath: 'v2/nodes/checkerboard.py'
    }
    mocks.applyAgentProposal.mockResolvedValue(appliedFiles)

    render(CustomNodeWorkbench, {
      props: {
        sessionId: 'session-1',
        agentEnabled: true,
        packName: 'Checkerboard Mask'
      },
      global: { plugins: [i18n] }
    })

    await user.type(
      screen.getByRole('textbox', { name: 'Describe a node change' }),
      'Add a configurable color'
    )
    await user.click(screen.getByRole('button', { name: 'Propose changes' }))

    await waitFor(() => {
      expect(mocks.saveAll).toHaveBeenCalledOnce()
      expect(mocks.createAgentProposal).toHaveBeenCalledWith(
        'session-1',
        'Add a configurable color'
      )
    })
    expect(mocks.saveAll.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createAgentProposal.mock.invocationCallOrder[0]
    )
    expect(screen.getByText('Added a configurable color.')).toBeVisible()
    expect(screen.getByTestId('proposal-diff')).toHaveAttribute(
      'data-theme',
      'dark'
    )
    expect(screen.getByTestId('original-content')).toHaveTextContent(
      '# locally edited'
    )
    expect(screen.getByTestId('proposed-content')).toHaveTextContent(
      '# agent proposal'
    )
    expect(mocks.applyAgentProposal).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Apply changes' }))

    await waitFor(() => {
      expect(mocks.applyAgentProposal).toHaveBeenCalledWith(
        'session-1',
        'proposal-1'
      )
      expect(mocks.replaceFiles).toHaveBeenCalledWith(appliedFiles)
    })
    expect(screen.getByTestId('custom-node-tree-editor')).toBeVisible()
  })

  it('restores and persists whether the Node Agent is open for the pack', async () => {
    const user = userEvent.setup()
    const key = customNodeEditorStateKey('workspace-1', 'Checkerboard Mask')
    updateCustomNodeEditorState(key, { agentOpen: false })

    render(CustomNodeWorkbench, {
      props: {
        sessionId: 'session-1',
        agentEnabled: true,
        packName: 'Checkerboard Mask'
      },
      global: { plugins: [i18n] }
    })

    const agent = screen.getByRole('complementary', { name: 'Node Agent' })
    expect(agent).toHaveAttribute('data-open', 'false')

    await user.click(screen.getByRole('button', { name: 'Toggle Node Agent' }))
    await waitFor(() => {
      expect(readCustomNodeEditorState(key)).toMatchObject({ agentOpen: true })
    })
  })

  it('moves the local editor state when the pack is renamed', async () => {
    const previousKey = customNodeEditorStateKey(
      'workspace-1',
      'Checkerboard Mask'
    )
    const nextKey = customNodeEditorStateKey('workspace-1', 'Renamed Pack')
    updateCustomNodeEditorState(previousKey, {
      activePath: 'README.md',
      agentOpen: false
    })

    const view = render(CustomNodeWorkbench, {
      props: {
        sessionId: 'session-1',
        agentEnabled: true,
        packName: 'Checkerboard Mask'
      },
      global: { plugins: [i18n] }
    })
    await view.rerender({ packName: 'Renamed Pack' })

    await waitFor(() => {
      expect(readCustomNodeEditorState(previousKey)).toBeNull()
      expect(readCustomNodeEditorState(nextKey)).toMatchObject({
        activePath: 'README.md',
        agentOpen: false
      })
    })
  })
})

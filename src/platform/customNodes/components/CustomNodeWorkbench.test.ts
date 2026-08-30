import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
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
    props: ['sessionId', 'stateKey', 'packName', 'explorerOpen'],
    emits: ['update:explorerOpen'],
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
            working: 'Building and testing…',
            proposal: 'Proposed changes',
            testStatus: {
              passed: 'Backend test passed',
              failed: 'Backend test failed',
              not_run: 'Backend test not run',
              unavailable: 'Backend test unavailable'
            },
            testDuration: 'Completed in {duration} ms',
            testPhase: 'Phase: {phase}',
            testSandbox: 'Sandbox: {sandbox}',
            traceback: 'Python traceback',
            testLogs: 'Captured process output',
            stdout: 'stdout',
            stderr: 'stderr',
            testOutput: 'Output {index}: {kind}',
            testPreview: 'Draft test preview for output {output}',
            reviewNotice: 'Review before applying.',
            apply: 'Apply changes',
            dismiss: 'Dismiss',
            failed: 'Proposal failed',
            applyFailed: 'Apply failed',
            structuralChange: 'This changes the project tree.',
            unavailable: 'Node Agent unavailable',
            unavailableDetail: 'Server key required',
            safety: 'Node Agent cannot run code or submit.'
          }
        }
      }
    }
  }
})

const WorkbenchHarness = defineComponent({
  components: { CustomNodeWorkbench },
  setup() {
    return { agentOpen: ref(false) }
  },
  template: `
    <button type="button" @click="agentOpen = !agentOpen">
      Toggle Node Agent
    </button>
    <CustomNodeWorkbench
      v-model:agent-open="agentOpen"
      session-id="session-1"
      :agent-enabled="true"
      pack-name="Checkerboard Mask"
    />
  `
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
          kind: 'modified',
          path: 'v2/nodes/checkerboard.py',
          originalContent: '# locally edited\n',
          proposedContent: '# agent proposal\n'
        }
      ],
      test: {
        status: 'passed',
        summary: 'Ephemeral test workflow completed with 1 output.',
        testId: 'test-1',
        phase: 'complete',
        sandbox: 'seatbelt',
        durationMs: 842,
        stdout: 'draft says hello\n',
        stderr: '',
        outputs: [
          {
            index: 0,
            kind: 'IMAGE',
            shape: [1, 64, 64, 3],
            dtype: 'float32',
            artifacts: [
              {
                name: 'output-0-0.png',
                mime_type: 'image/png',
                url: '/api/customnodes/editor/sessions/session-1/tests/test-1/artifacts/output-0-0.png'
              }
            ]
          }
        ]
      },
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
      directories: ['v2', 'v2/nodes'],
      initialPath: 'v2/nodes/checkerboard.py',
      digest: 'digest-2'
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
    expect(screen.getByText('Backend test passed')).toBeVisible()
    expect(
      screen.getByText('Ephemeral test workflow completed with 1 output.')
    ).toBeVisible()
    expect(screen.getByText('Completed in 842 ms')).toBeVisible()
    expect(screen.getByText('Phase: complete')).toBeVisible()
    expect(screen.getByText('Sandbox: seatbelt')).toBeVisible()
    expect(screen.getByTestId('node-agent-test-outputs')).toHaveTextContent(
      'Output 1: IMAGE'
    )
    expect(
      screen.getByRole('img', { name: 'Draft test preview for output 1' })
    ).toHaveAttribute(
      'src',
      '/api/customnodes/editor/sessions/session-1/tests/test-1/artifacts/output-0-0.png'
    )
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

  it('reviews structural Node Agent operations without showing an empty diff', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockResolvedValue({
      id: 'proposal-2',
      summary: 'Organized the helper module.',
      changes: [
        {
          kind: 'moved',
          path: 'v2/nodes/helper.py',
          destinationPath: 'v2/nodes/helpers/helper.py',
          originalContent: '# helper\n',
          proposedContent: '# helper\n'
        }
      ],
      createdAt: '2026-08-29T12:00:00Z'
    })

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
      'Move the helper module'
    )
    await user.click(screen.getByRole('button', { name: 'Propose changes' }))

    expect(
      await screen.findAllByText(
        'v2/nodes/helper.py → v2/nodes/helpers/helper.py'
      )
    ).toHaveLength(2)
    expect(screen.getByTestId('proposal-structural-change')).toBeVisible()
    expect(screen.queryByTestId('proposal-diff')).not.toBeInTheDocument()
  })

  it('shows Python diagnostics from the unpublished draft sandbox', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockResolvedValue({
      id: 'proposal-failed',
      summary: 'The draft still needs repair.',
      changes: [
        {
          kind: 'modified',
          path: 'v2/nodes/checkerboard.py',
          originalContent: '# before\n',
          proposedContent: '# broken\n'
        }
      ],
      test: {
        status: 'failed',
        summary: 'execute failed: ValueError: draft boom',
        testId: 'test-failed',
        phase: 'execute',
        sandbox: 'seatbelt',
        durationMs: 31,
        stdout: 'draft reached execute\n',
        stderr: '',
        outputs: [],
        error: {
          type: 'ValueError',
          message: 'draft boom',
          frames: [
            {
              file: 'v2/nodes/checkerboard.py',
              line: 18,
              function: 'execute',
              source: 'raise ValueError("draft boom")'
            }
          ]
        }
      },
      createdAt: '2026-08-29T12:00:00Z'
    })

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
      'Break the draft'
    )
    await user.click(screen.getByRole('button', { name: 'Propose changes' }))

    expect(
      await screen.findByTestId('node-agent-python-error')
    ).toHaveTextContent('ValueError: draft boom')
    expect(screen.getByText(/v2\/nodes\/checkerboard\.py:18/)).toBeVisible()
    await user.click(screen.getByText('Captured process output'))
    expect(screen.getByText('draft reached execute')).toBeVisible()
  })

  it('restores and persists whether the Node Agent is open for the pack', async () => {
    const user = userEvent.setup()
    const key = customNodeEditorStateKey('workspace-1', 'Checkerboard Mask')
    updateCustomNodeEditorState(key, { agentOpen: false })

    render(WorkbenchHarness, {
      global: { plugins: [i18n] }
    })

    const agent = screen.getByRole('complementary', { name: 'Node Agent' })
    expect(agent).toHaveAttribute('data-open', 'false')

    await user.click(screen.getByRole('button', { name: 'Toggle Node Agent' }))
    await waitFor(() => {
      expect(readCustomNodeEditorState(key)).toMatchObject({ agentOpen: true })
    })
    expect(agent).toHaveAttribute('data-open', 'true')
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

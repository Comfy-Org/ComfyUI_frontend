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
  getSession: vi.fn(),
  replaceFiles: vi.fn(),
  reportError: vi.fn(),
  restoreCheckpoint: vi.fn(),
  saveAll: vi.fn()
}))

vi.mock('../composables/useCustomNodeEditor', () => ({
  useCustomNodeEditor: () => ({
    applyAgentProposal: mocks.applyAgentProposal,
    createAgentProposal: mocks.createAgentProposal,
    getSession: mocks.getSession,
    restoreCheckpoint: mocks.restoreCheckpoint
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
            samplePrompt: 'Add a configurable checkerboard color',
            placeholder: 'Describe a node change',
            send: 'Send',
            stop: 'Stop',
            stopped: 'Stopped.',
            applied: 'Changes applied',
            restore: 'Restore',
            restoreLabel: 'Restore the files from this point',
            restored: 'Files restored to this point.',
            restoreFailed: 'Could not restore the files.',
            working: 'Building and testing…',
            steps: 'Worked through {count} steps',
            applying: 'Applying changes…',
            restoring: 'Restoring files…',
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
            failed: 'Proposal failed',
            applyFailed: 'Apply failed',
            structuralChange: 'This changes the project tree.',
            unavailable: 'Node Agent unavailable',
            unavailableDetail: 'Server key required'
          }
        }
      }
    }
  }
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
    mocks.applyAgentProposal.mockReset().mockResolvedValue(appliedFiles)
    mocks.createAgentProposal.mockReset()
    mocks.getSession.mockReset().mockResolvedValue({
      agentActivity: ['Reading the manifest doc', 'Sandbox test passed']
    })
    mocks.replaceFiles.mockReset().mockResolvedValue(undefined)
    mocks.reportError.mockReset()
    mocks.restoreCheckpoint.mockReset().mockResolvedValue(appliedFiles)
    mocks.saveAll.mockReset().mockResolvedValue(undefined)
  })

  it('opens with a minimal starter and persistent prompt composer', async () => {
    const user = userEvent.setup()
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
    expect(screen.getByText('Describe the change.')).toBeVisible()
    const samplePrompt = screen.getByRole('button', {
      name: 'Add a configurable checkerboard color'
    })
    const prompt = screen.getByRole('textbox', {
      name: 'Describe a node change'
    })
    expect(samplePrompt).toBeVisible()
    expect(prompt).toBeVisible()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    await user.click(samplePrompt)
    expect(prompt).toHaveValue('Add a configurable checkerboard color')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(screen.queryByText(/Getting Started/i)).not.toBeInTheDocument()
  })

  it('saves edits, tests, and applies agent work automatically', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(mocks.saveAll).toHaveBeenCalledOnce()
      expect(mocks.createAgentProposal).toHaveBeenCalledWith(
        'session-1',
        'Add a configurable color',
        expect.any(AbortSignal)
      )
      expect(mocks.applyAgentProposal).toHaveBeenCalledWith(
        'session-1',
        'proposal-1'
      )
      expect(mocks.replaceFiles).toHaveBeenCalledWith(appliedFiles)
    })
    expect(mocks.saveAll.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createAgentProposal.mock.invocationCallOrder[0]
    )
    expect(mocks.createAgentProposal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.applyAgentProposal.mock.invocationCallOrder[0]
    )
    expect(screen.getByText('Added a configurable color.')).toBeVisible()
    expect(
      screen.getByText('Add a configurable color', { exact: true })
    ).toBeVisible()
    expect(screen.queryByTestId('node-agent-start')).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Describe a node change' })
    ).toBeVisible()
    expect(screen.getByText('Changes applied')).toBeVisible()
    expect(screen.queryByTestId('node-agent-activity')).not.toBeInTheDocument()

    const turnActivity = screen.getByTestId('node-agent-turn-activity')
    expect(turnActivity).toHaveTextContent('Worked through 2 steps')
    await user.click(screen.getByText('Worked through 2 steps'))
    expect(screen.getByText('Reading the manifest doc')).toBeVisible()
    expect(screen.getByText('Sandbox test passed')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Apply changes' })
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('img', { name: 'Draft test preview for output 1' })
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Draft test preview for output 1' })
    ).toHaveAttribute(
      'src',
      '/api/customnodes/editor/sessions/session-1/tests/test-1/artifacts/output-0-0.png'
    )

    expect(screen.getByText('Backend test passed')).toBeVisible()
    expect(
      screen.getByText('Ephemeral test workflow completed with 1 output.')
    ).not.toBeVisible()
    await user.click(screen.getByText('Backend test passed'))
    expect(
      screen.getByText('Ephemeral test workflow completed with 1 output.')
    ).toBeVisible()
    expect(screen.getByText('Completed in 842 ms')).toBeVisible()
    expect(screen.getByText('Phase: complete')).toBeVisible()
    expect(screen.getByText('Sandbox: seatbelt')).toBeVisible()
    expect(screen.getByTestId('node-agent-test-outputs')).toHaveTextContent(
      'Output 1: IMAGE'
    )

    expect(screen.queryByTestId('proposal-diff')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'v2/nodes/checkerboard.py' })
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
    await user.click(
      screen.getByRole('button', { name: 'v2/nodes/checkerboard.py' })
    )
    expect(screen.queryByTestId('proposal-diff')).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await user.click(
      await screen.findByRole('button', {
        name: 'v2/nodes/helper.py → v2/nodes/helpers/helper.py'
      })
    )
    expect(
      screen.getAllByText('v2/nodes/helper.py → v2/nodes/helpers/helper.py')
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
    await user.click(screen.getByRole('button', { name: 'Send' }))

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

  it('replaces Send with Stop while the agent is working', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockImplementation(
      (_sessionId: string, _instruction: string, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
    )

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
      'Try a long-running change'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    const activity = await screen.findByTestId('node-agent-activity')
    expect(activity).toBeVisible()
    expect(activity).toHaveTextContent('Building and testing…')

    await user.click(await screen.findByRole('button', { name: 'Stop' }))

    expect(await screen.findByText('Stopped.')).toBeVisible()
    expect(screen.queryByTestId('node-agent-activity')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeVisible()
    expect(mocks.applyAgentProposal).not.toHaveBeenCalled()
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it('keeps later prompts and applied agent work in one conversation', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal
      .mockResolvedValueOnce({
        id: 'proposal-1',
        summary: 'Prepared the first change.',
        changes: [
          {
            kind: 'modified',
            path: 'README.md',
            originalContent: 'before',
            proposedContent: 'first'
          }
        ],
        createdAt: '2026-08-29T12:00:00Z'
      })
      .mockResolvedValueOnce({
        id: 'proposal-2',
        summary: 'Refined the applied change.',
        changes: [
          {
            kind: 'modified',
            path: 'README.md',
            originalContent: 'first',
            proposedContent: 'refined'
          }
        ],
        createdAt: '2026-08-29T12:01:00Z'
      })

    render(CustomNodeWorkbench, {
      props: {
        sessionId: 'session-1',
        agentEnabled: true,
        packName: 'Checkerboard Mask'
      },
      global: { plugins: [i18n] }
    })
    const prompt = screen.getByRole('textbox', {
      name: 'Describe a node change'
    })

    await user.type(prompt, 'Build the first version')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Prepared the first change.')).toBeVisible()

    await user.type(prompt, 'Now refine it')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Refined the applied change.')).toBeVisible()

    const conversation = screen.getByTestId('node-agent-conversation')
    expect(conversation).toHaveTextContent('Build the first version')
    expect(conversation).toHaveTextContent('Prepared the first change.')
    expect(conversation).toHaveTextContent('Now refine it')
    expect(conversation).toHaveTextContent('Refined the applied change.')
    await waitFor(() => {
      expect(screen.getAllByText('Changes applied')).toHaveLength(2)
    })
    expect(mocks.createAgentProposal).toHaveBeenCalledTimes(2)
    expect(mocks.applyAgentProposal).toHaveBeenCalledTimes(2)
  })

  it('restores the checkpoint for an applied agent turn', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockResolvedValue({
      id: 'proposal-1',
      summary: 'Prepared the change.',
      changes: [
        {
          kind: 'modified',
          path: 'README.md',
          originalContent: 'before',
          proposedContent: 'after'
        }
      ],
      createdAt: '2026-08-29T12:00:00Z'
    })
    const restoredFiles = {
      files: [{ path: 'README.md', content: 'before', editable: true }],
      directories: [],
      initialPath: 'README.md',
      digest: 'digest-restored'
    }
    let resolveRestore!: (files: typeof restoredFiles) => void
    mocks.restoreCheckpoint.mockImplementation(
      () =>
        new Promise<typeof restoredFiles>((resolve) => {
          resolveRestore = resolve
        })
    )

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
      'Change the readme'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Changes applied')).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Restore the files from this point' })
    )

    const activity = await screen.findByTestId('node-agent-activity')
    expect(activity).toBeVisible()
    expect(activity).toHaveTextContent('Restoring files…')
    resolveRestore(restoredFiles)

    await waitFor(() => {
      expect(mocks.restoreCheckpoint).toHaveBeenCalledWith(
        'session-1',
        'proposal-1'
      )
      expect(mocks.replaceFiles).toHaveBeenLastCalledWith(restoredFiles)
    })
    expect(screen.getByText('Files restored to this point.')).toBeVisible()
    expect(screen.queryByTestId('node-agent-activity')).not.toBeInTheDocument()
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it('renders answer-only turns without applying anything', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockResolvedValue({
      id: 'proposal-answer',
      summary:
        'The mask output marks blanked squares with 1.0; nothing needs to change.',
      changes: [],
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
      'How is the mask computed?'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(
      await screen.findByText(
        'The mask output marks blanked squares with 1.0; nothing needs to change.'
      )
    ).toBeVisible()
    expect(mocks.applyAgentProposal).not.toHaveBeenCalled()
    expect(screen.queryByText('Changes applied')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Restore the files from this point'
      })
    ).not.toBeInTheDocument()
  })

  it('reports when applying the agent work fails', async () => {
    const user = userEvent.setup()
    mocks.createAgentProposal.mockResolvedValue({
      id: 'proposal-1',
      summary: 'Prepared the change.',
      changes: [
        {
          kind: 'modified',
          path: 'README.md',
          originalContent: 'before',
          proposedContent: 'after'
        }
      ],
      createdAt: '2026-08-29T12:00:00Z'
    })
    mocks.applyAgentProposal.mockRejectedValue(
      new Error('The workspace changed while applying.')
    )

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
      'Change the readme'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(
      await screen.findByText('The workspace changed while applying.')
    ).toBeVisible()
    expect(screen.getByText('Prepared the change.')).toBeVisible()
    expect(screen.queryByText('Changes applied')).not.toBeInTheDocument()
    expect(mocks.reportError).toHaveBeenCalledOnce()
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

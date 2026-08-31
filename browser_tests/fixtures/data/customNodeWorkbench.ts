import type {
  CustomNodeEditorFilesDto,
  CustomNodeEditorProposalDto,
  CustomNodeEditorSessionDto
} from '@/platform/customNodes/composables/useCustomNodeEditor'

export const nodeAgentEditorSession = {
  id: 'node-agent-session',
  mode: 'create',
  name: 'New Custom Node',
  status: 'ready',
  editor_kind: 'workbench',
  agent_enabled: true,
  created_at: '2026-08-30T07:00:00Z',
  updated_at: '2026-08-30T07:00:00Z'
} satisfies CustomNodeEditorSessionDto

export const nodeAgentEditorFiles = {
  files: [
    {
      path: 'README.md',
      content: '# New Custom Node\n',
      editable: true
    },
    {
      path: 'v2/nodes/checkerboard.py',
      content: 'from comfy_api.latest import io\n',
      editable: true
    }
  ],
  directories: ['v2', 'v2/nodes'],
  initial_path: 'v2/nodes/checkerboard.py',
  digest: 'digest-1'
} satisfies CustomNodeEditorFilesDto

export const testedNodeAgentProposal = {
  id: 'proposal-1',
  summary: 'Added a configurable checkerboard color.',
  changes: [
    {
      kind: 'modified',
      path: 'v2/nodes/checkerboard.py',
      original_content: 'from comfy_api.latest import io\n',
      proposed_content:
        'from comfy_api.latest import io\nCHECKERBOARD_COLOR = 0x334455\n'
    }
  ],
  test: {
    status: 'passed',
    summary: 'Ephemeral test workflow completed with 1 output.',
    test_id: 'draft-test-1',
    phase: 'complete',
    sandbox: 'seatbelt',
    duration_ms: 2184,
    stdout: '',
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
            url: '/api/customnodes/editor/sessions/node-agent-session/tests/draft-test-1/artifacts/output-0-0.png'
          }
        ]
      }
    ]
  },
  created_at: '2026-08-30T07:00:20Z'
} satisfies CustomNodeEditorProposalDto

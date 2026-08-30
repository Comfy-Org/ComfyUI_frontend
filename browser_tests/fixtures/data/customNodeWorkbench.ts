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
    summary: 'Workflow completed with 1 output node(s).',
    prompt_id: '079b4c13-b5b0-db37-591a-e3e8003303f1',
    duration_ms: 13281,
    output_nodes: ['3']
  },
  created_at: '2026-08-30T07:00:20Z'
} satisfies CustomNodeEditorProposalDto

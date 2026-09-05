const everyRecording = [
  'agent-l4-zimage-string-node-prompt',
  'agent-rec-add-set-delete',
  'agent-rec-asset-url-reply',
  'agent-rec-batched-ops',
  'agent-rec-cancelled-turn',
  'agent-rec-clarifying-question',
  'agent-rec-clear-workflow',
  'agent-rec-refiner-between',
  'agent-rec-replace-prompt-encoder',
  'agent-rec-set-widget-existing',
  'agent-rec-text-only-answer',
  'agent-rec-three-sequential-adds',
  'agent-rec-tool-error',
  'agent-rec-two-turn-dependent-edit',
  'agent-workflow-editing-05'
] as const

type AgentConversationCapability =
  | {
      capability: string
      status: 'supported'
      recordings: readonly string[]
    }
  | {
      capability: string
      status: 'recordable'
      reason: string
    }
  | {
      capability: string
      status: 'blocked'
      scope?: string
      reason: string
    }
  | {
      capability: string
      status: 'out_of_scope'
      reason: string
    }

export const agentConversationCapabilityMatrix: readonly AgentConversationCapability[] =
  [
    {
      capability: 'add_node',
      status: 'supported',
      recordings: [
        'agent-l4-zimage-string-node-prompt',
        'agent-rec-add-set-delete',
        'agent-rec-batched-ops',
        'agent-rec-cancelled-turn',
        'agent-rec-clear-workflow',
        'agent-rec-refiner-between',
        'agent-rec-replace-prompt-encoder',
        'agent-rec-three-sequential-adds',
        'agent-rec-two-turn-dependent-edit',
        'agent-workflow-editing-05'
      ]
    },
    {
      capability: 'connect',
      status: 'supported',
      recordings: [
        'agent-l4-zimage-string-node-prompt',
        'agent-rec-add-set-delete',
        'agent-rec-batched-ops',
        'agent-rec-refiner-between',
        'agent-rec-replace-prompt-encoder',
        'agent-rec-two-turn-dependent-edit',
        'agent-workflow-editing-05'
      ]
    },
    {
      capability: 'set_widget',
      status: 'supported',
      recordings: [
        'agent-l4-zimage-string-node-prompt',
        'agent-rec-add-set-delete',
        'agent-rec-clarifying-question',
        'agent-rec-refiner-between',
        'agent-rec-replace-prompt-encoder',
        'agent-rec-set-widget-existing',
        'agent-rec-two-turn-dependent-edit'
      ]
    },
    {
      capability: 'delete_node',
      status: 'supported',
      recordings: [
        'agent-rec-add-set-delete',
        'agent-rec-replace-prompt-encoder'
      ]
    },
    {
      capability: 'clear',
      status: 'supported',
      recordings: ['agent-rec-clear-workflow']
    },
    {
      capability: 'agent_thinking',
      status: 'supported',
      recordings: [
        'agent-l4-zimage-string-node-prompt',
        'agent-rec-add-set-delete',
        'agent-rec-cancelled-turn',
        'agent-rec-clarifying-question',
        'agent-rec-refiner-between',
        'agent-rec-replace-prompt-encoder',
        'agent-rec-set-widget-existing',
        'agent-rec-text-only-answer',
        'agent-rec-three-sequential-adds',
        'agent-rec-tool-error',
        'agent-rec-two-turn-dependent-edit',
        'agent-workflow-editing-05'
      ]
    },
    {
      capability: 'agent_tool_call',
      status: 'supported',
      recordings: everyRecording
    },
    {
      capability: 'agent_message_delta',
      status: 'supported',
      recordings: everyRecording
    },
    {
      capability: 'agent_message_done',
      status: 'supported',
      recordings: everyRecording
    },
    {
      capability: 'agent_active_tab',
      status: 'supported',
      recordings: everyRecording
    },
    {
      capability: 'tool_error',
      status: 'supported',
      recordings: [
        'agent-l4-zimage-string-node-prompt',
        'agent-rec-refiner-between',
        'agent-rec-tool-error',
        'agent-workflow-editing-05'
      ]
    },
    {
      capability: 'clarifying_question',
      status: 'supported',
      recordings: ['agent-rec-clarifying-question']
    },
    {
      capability: 'cancelled_turn',
      status: 'supported',
      recordings: ['agent-rec-cancelled-turn']
    },
    {
      capability: 'multi_turn_dependent_edit',
      status: 'supported',
      recordings: [
        'agent-rec-add-set-delete',
        'agent-rec-clarifying-question',
        'agent-rec-two-turn-dependent-edit'
      ]
    },
    {
      capability: 'asset_url_in_reply_text',
      status: 'supported',
      recordings: ['agent-rec-asset-url-reply']
    },
    {
      capability: 'agent_asset',
      status: 'blocked',
      reason: 'panel-does-not-render-event'
    },
    {
      capability: 'agent_ask',
      status: 'recordable',
      reason: 'recording-not-yet-captured'
    },
    {
      capability: 'agent_ask_resolved',
      status: 'recordable',
      reason: 'recording-not-yet-captured'
    },
    {
      capability: 'reset_doc',
      status: 'blocked',
      reason: 'deferred-by-op-vocabulary'
    },
    {
      capability: 'promoted_subgraph_widget',
      status: 'recordable',
      reason: 'recording-not-yet-captured'
    },
    {
      capability: 'subgraph_internals',
      status: 'out_of_scope',
      reason: 'decided 2026-09-04: internals are not part of the suite.'
    }
  ]

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  MESSAGE_ID,
  THREAD_ID,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

export const RUN_JOB_ID = 'agent-exec-server-run-pm-2275'
export const SHOWN_OUTPUT = 'agent-run-shown-output.png'
export const HIDDEN_OUTPUT = 'agent-run-hidden-output.png'

export const runSuccessFrame: AgentWsEvent = {
  type: 'agent_tool_call',
  data: {
    thread_id: THREAD_ID,
    message_id: MESSAGE_ID,
    tool_call_id: 'call-run-pm-2275',
    tool_name: 'run',
    status: 'success',
    duration_ms: 40,
    job_id: RUN_JOB_ID,
    job_workflow_id: WORKFLOW_ID
  }
}

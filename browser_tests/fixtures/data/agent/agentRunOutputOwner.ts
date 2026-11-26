import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  MESSAGE_ID,
  THREAD_ID,
  WORKFLOW_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

export const RUN_JOB_ID = 'agent-exec-server-run-pm-2275'
export const SHOWN_OUTPUT = 'agent-run-shown-output.png'
export const HIDDEN_OUTPUT = 'agent-run-hidden-output.png'

/** The settled `run` tool call that names the job it submitted for this workflow. */
export function runSuccessFrameFor(jobId: string): AgentWsEvent {
  return {
    type: 'agent_tool_call',
    data: {
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID,
      tool_call_id: `call-run-${jobId}`,
      tool_name: 'run',
      status: 'success',
      duration_ms: 40,
      job_id: jobId,
      job_workflow_id: WORKFLOW_ID
    }
  }
}

export const runSuccessFrame = runSuccessFrameFor(RUN_JOB_ID)

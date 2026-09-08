import { deepStrictEqual } from 'node:assert/strict'

import type { PostMessageInput } from '@/workbench/extensions/agent/services/agent/agentRestClient'

import type {
  AgentRequestResponseScenario,
  AgentResponseStep
} from '@e2e/fixtures/data/agentRequestResponse'

export class AgentRequestResponseQueue {
  private nextScenarioIndex = 0

  constructor(
    private readonly scenarios: readonly AgentRequestResponseScenario[]
  ) {}

  take(request: PostMessageInput): readonly AgentResponseStep[] {
    const requestNumber = this.nextScenarioIndex + 1
    if (this.nextScenarioIndex >= this.scenarios.length) {
      throw new Error(
        `Unexpected agent request ${requestNumber}: no scenarios remain`
      )
    }
    const scenario = this.scenarios[this.nextScenarioIndex]

    try {
      deepStrictEqual(request, scenario.request)
    } catch (cause) {
      throw new Error(
        `Agent request ${requestNumber} did not match the declared scenario`,
        { cause }
      )
    }

    this.nextScenarioIndex++
    return scenario.responses
  }

  assertComplete(): void {
    const remaining = this.scenarios.length - this.nextScenarioIndex
    if (remaining > 0) {
      throw new Error(
        `Agent request queue has ${remaining} unconsumed scenarios`
      )
    }
  }
}

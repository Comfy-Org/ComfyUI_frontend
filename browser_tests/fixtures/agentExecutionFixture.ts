import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { AgentExecutionHelper } from '@e2e/fixtures/helpers/AgentExecutionHelper'
import { MultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/MultiAutogrowRealignHarness'

export interface AgentExecutionRig {
  harness: MultiAutogrowRealignHarness
  execution: AgentExecutionHelper
}

/**
 * The agent harness plus its execution surface: routed `/ws` host, agent
 * endpoints, a bound follower with the target node visible, and on top of
 * that a live queue — `/api/prompt` answered with a job id, a stateful
 * `/api/jobs` list, execution frames on the shared socket and `/api/view`
 * bytes for outputs. The execution helper installs after the harness so its
 * routes win over the harness's own inert `/api/prompt` and `/api/jobs`
 * stubs.
 *
 * `Comfy.Queue.QPOV2` is pinned off so the queue observables are the floating
 * overlay's, deterministically — the default follows the release channel.
 */
export const agentExecutionTest = agentTest.extend<{
  rig: AgentExecutionRig
}>({
  rig: async ({ page }, use) => {
    const harness = new MultiAutogrowRealignHarness(page)
    await harness.setUp({ settings: { 'Comfy.Queue.QPOV2': false } })
    const execution = new AgentExecutionHelper(page, harness.hostSocket)
    await execution.install()
    await harness.bindAndAwaitFirstTurn()
    await use({ harness, execution })
  }
})

import { expect, mergeTests } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * FE-3200. Opening the agent panel failed to load the thread list for 213
 * distinct users over 3.3 days — 0.236% of panel opens — and the cause was
 * unreadable from anything recorded: `app:agent_error` carried no status and no
 * endpoint, and the Sentry report landed in `CLOUD-FRONTEND-PROD-1`, a merged
 * issue holding 49 distinct `error_type` values and ~18M events, where 168 of
 * the 173 reports in a 14-day window were invisible.
 *
 * This proves the diagnosis travels from a real failed request in a real
 * browser, through the production `reportError` fan-out and the production
 * telemetry registry, with no thread id, email or message anywhere in it.
 */
const test = mergeTests(agentTest, hostTelemetryFixture)

test.describe(
  'Agent panel thread-load diagnostics',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('reports the status and route of a refused thread-list load', async ({
      hostTelemetry,
      hostErrorReports,
      page
    }) => {
      await bootAgentApp(page, true, {
        features: { enable_telemetry: true },
        // Back to the production default, which the panel fixture turns off for
        // every other spec. `useErrorOverlayState` gates visibility on it, so
        // without it the blocking overlay this failure produces for real users
        // never renders and the spec would assert only half the behaviour.
        settings: { 'Comfy.RightSidePanel.ShowErrorsTab': true },
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads', (route) =>
            route.fulfill({ status: 401, body: '{"error":"unauthorized"}' })
          )
          await page.route('**/api/agent/run-mode', (route) =>
            route.fulfill(
              jsonRoute({ mode: 'ask_approval', credit_limit: null })
            )
          )
        }
      })

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      // The user is left in the panel with no thread list — the state the 227
      // events describe. The blocking overlay is deliberately NOT asserted
      // here: `surfaceAgentError` records the prompt error against
      // `activeRunErrorKey`, which is null on a fresh boot, so the overlay did
      // not render in this harness even with the issues tab on. The failure is
      // still classified `ui_treatment: 'error_overlay'` below, so what the
      // user actually sees is an open question for FE-3200's fix step rather
      // than something this carrier can claim.
      await expect(agentPanel.root.getByTestId('agent-composer')).toBeVisible()

      // The diagnosis, read off the `reportError` fan-out — the leg that makes
      // the failure group in Sentry, and the half FE-3200 believed was missing
      // altogether. Observed through the production desktop-bridge sink, since
      // Sentry is not initialized in E2E and Datadog RUM is gated on a
      // comfy.org hostname, so neither of those two can be read here.
      //
      // The `app:agent_error` event is NOT asserted here, because
      // `HostTelemetrySink` implements no `trackAgentError` — 27 sibling
      // `trackAgent*` methods and not that one — so it never reaches the
      // bridge and no browser-side sink can see it. Its payload is pinned in
      // `AgentPanelRoot.test.ts` instead. Wiring the host sink would change
      // what Desktop emits, which is a telemetry-surface decision, not part of
      // this carrier.
      await expect
        .poll(() =>
          hostErrorReports.find(
            ({ properties }) =>
              properties.error_type === 'agent_thread_list_load_failed'
          )
        )
        .toMatchObject({
          properties: {
            error_type: 'agent_thread_list_load_failed',
            surface: 'agent',
            request_path: '/agent/threads',
            // A 401 is in `NON_RETRYABLE_REQUEST_STATUSES`, which is the whole
            // explanation of the near-even retryable split the ticket flagged
            // as suspicious — legible only now that the status rides along.
            request_status: 401,
            request_error: 'AgentApiError'
          }
        })

      // The fields this carrier adds leak nothing: no raw path, no query, and
      // nothing out of the response body. Scoped to the property bags on
      // purpose — `reportError` has always sent `error.message` and `error.stack`
      // to its sinks, so the server's own wording ("unauthorized" here) reaches
      // Sentry through a surface that predates this change and that `#19740`
      // already ruled on when it stripped routes and ids from the message
      // itself. Widening this sweep to the whole report would be asserting a
      // property the product does not have.
      const properties = JSON.stringify([
        hostTelemetry.map(({ properties }) => properties),
        hostErrorReports.map(({ properties }) => properties)
      ])
      expect(properties).not.toContain('unauthorized')
      expect(properties).not.toContain('/api/agent/threads')
    })
  }
)

import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test(
  'names the HTTP status when the failure carries no reason phrase',
  { tag: '@cloud' },
  async ({
    agentMessageHttpErrorMock: _agentMessageHttpErrorMock,
    agentPanel
  }) => {
    // Regression: https://github.com/Comfy-Org/ComfyUI_frontend/pull/18374
    // The notice falls back to `Response.statusText`, and HTTP/2 — what cloud
    // serves — has no reason phrase, so a 5xx with an unparseable body left the
    // bubble reading "Message failed to send: " with nothing after the colon.
    //
    // Stubbed at `fetch` rather than with `page.route`, which cannot express
    // this: Playwright fulfills over HTTP/1.1, where Chromium always supplies a
    // phrase ("Service Unavailable" for 503, "Unknown" for an unassigned code).
    // A browser-built `Response` leaves `statusText` empty, as HTTP/2 does.
    await agentPanel.open()
    await agentPanel.selectWorkflow()

    await agentPanel.composer.fill('Build a product photo workflow')
    await agentPanel.sendButton.click()

    await expect(
      agentPanel.root.getByText(enMessages.agent.sendFailed)
    ).toBeVisible()
    // The status is the assertion: the notice above is already visible without
    // the fix, carrying nothing after its colon.
    await expect(
      agentPanel.root.getByText('Agent request failed (HTTP 503)')
    ).toBeVisible()
  }
)

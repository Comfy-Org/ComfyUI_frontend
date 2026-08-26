import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  LogsTerminalHelper,
  logsTerminalFixture
} from '@e2e/fixtures/helpers/LogsTerminalHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  getClipboardText,
  interceptClipboardWrite
} from '@e2e/fixtures/utils/clipboardSpy'

const test = mergeTests(comfyPageFixture, logsTerminalFixture, webSocketFixture)

test.describe('Bottom Panel Logs', { tag: '@ui' }, () => {
  test.describe('panel', () => {
    test.beforeEach(async ({ logsTerminal }) => {
      await logsTerminal.mockSubscribeLogs()
      await logsTerminal.mockRawLogs([])
    })

    test('opens to Logs tab via toggle button', async ({ comfyPage }) => {
      await expect(comfyPage.bottomPanel.root).toBeHidden()
      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.tab).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toBeVisible()
    })

    test('closes via toggle button', async ({ comfyPage }) => {
      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.root).toBeVisible()

      await comfyPage.bottomPanel.toggleButton.click()
      await expect(comfyPage.bottomPanel.root).toBeHidden()
    })

    test('switches from shortcuts to Logs tab', async ({ comfyPage }) => {
      await comfyPage.bottomPanel.keyboardShortcutsButton.click()
      await expect(comfyPage.bottomPanel.shortcuts.essentialsTab).toBeVisible()

      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.tab).toBeVisible()
      await expect(comfyPage.bottomPanel.shortcuts.essentialsTab).toBeHidden()
    })
  })

  test.describe('terminal', () => {
    test.beforeEach(async ({ logsTerminal }) => {
      await logsTerminal.mockSubscribeLogs()
      await logsTerminal.mockRawLogs([])
    })

    test('shows loading spinner while logs are loading', async ({
      comfyPage,
      logsTerminal
    }) => {
      const resolveRaw = await logsTerminal.mockRawLogsPending()

      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.loadingSpinner).toBeVisible()

      resolveRaw()
      await expect(comfyPage.bottomPanel.logs.loadingSpinner).toBeHidden()
    })

    test('renders initial log entries from the raw-logs API', async ({
      comfyPage,
      logsTerminal
    }) => {
      const logLine = 'Hello from ComfyUI backend!'
      await logsTerminal.mockRawLogs([logLine])

      await comfyPage.bottomPanel.toggleLogs()

      await expect(comfyPage.bottomPanel.logs.xtermScreen).toBeVisible()
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        logLine
      )
    })

    test('appends log entries received via WebSocket', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toBeVisible()

      const ws = await getWebSocket()
      const firstLine = 'First live log line'
      const secondLine = 'Second live log line'

      ws.send(LogsTerminalHelper.buildWsLogFrame([firstLine]))
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        firstLine
      )

      ws.send(LogsTerminalHelper.buildWsLogFrame([secondLine]))
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        firstLine
      )
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        secondLine
      )
    })

    test('copy button copies terminal contents to clipboard', async ({
      comfyPage,
      logsTerminal
    }) => {
      const logLine = 'Copy me to the clipboard'
      await logsTerminal.mockRawLogs([logLine])

      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        logLine
      )

      await interceptClipboardWrite(comfyPage.page)

      await comfyPage.bottomPanel.logs.terminalRoot.hover()
      await expect(comfyPage.bottomPanel.logs.copyButton).toBeVisible()
      await comfyPage.bottomPanel.logs.copyButton.click()

      await expect
        .poll(() => getClipboardText(comfyPage.page))
        .toContain(logLine)
    })

    test('shows error message when raw-logs API fails', async ({
      comfyPage,
      logsTerminal
    }) => {
      await logsTerminal.mockRawLogsError()

      await comfyPage.bottomPanel.toggleLogs()

      await expect(comfyPage.bottomPanel.logs.errorMessage).toBeVisible()
      await expect(comfyPage.bottomPanel.logs.errorMessage).toContainText(
        'Unable to load logs'
      )
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toBeHidden()
    })

    test('resyncs the terminal when the WebSocket reconnects', async ({
      comfyPage,
      logsTerminal,
      getWebSocket
    }) => {
      const subscribeFetches = await logsTerminal.mockSubscribeLogs()
      const initialLine = 'pre-reboot log line'
      const postRebootLineA = 'post-reboot line A'
      const postRebootLineB = 'post-reboot line B'

      await logsTerminal.mockRawLogs([initialLine])
      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        initialLine
      )

      // Swap the raw-logs mock so the next fetch returns the post-reboot view.
      await logsTerminal.mockRawLogs([postRebootLineA, postRebootLineB])

      const ws = await getWebSocket()
      await logsTerminal.triggerReconnect(ws, subscribeFetches)

      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        postRebootLineA
      )
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        postRebootLineB
      )
      // reset() before write means the pre-reboot line must be gone.
      await expect(comfyPage.bottomPanel.logs.terminalRoot).not.toContainText(
        initialLine
      )
    })

    test('resumes WebSocket log streaming after the reconnect', async ({
      comfyPage,
      logsTerminal,
      getWebSocket
    }) => {
      const subscribeFetches = await logsTerminal.mockSubscribeLogs()
      await logsTerminal.mockRawLogs(['initial'])
      await comfyPage.bottomPanel.toggleLogs()
      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        'initial'
      )

      await logsTerminal.mockRawLogs(['after-reboot snapshot'])

      const ws = await getWebSocket()
      await logsTerminal.triggerReconnect(ws, subscribeFetches)

      // The route handler fires again on the new connection; pull the latest
      // WebSocketRoute and push a live frame to prove the 'logs' listener
      // survived the reconnect.
      const liveLine = 'live log emitted after the reconnect'
      const newWs = await getWebSocket()
      newWs.send(LogsTerminalHelper.buildWsLogFrame([liveLine]))

      await expect(comfyPage.bottomPanel.logs.terminalRoot).toContainText(
        liveLine
      )
    })
  })
})

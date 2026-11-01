import { expect } from '@playwright/test'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

// The reply filter itself lives in the Cloud agent and is tested there
// (Comfy-Org/cloud services/agent/internal/loop/scrub_code_test.go). This spec
// feeds the already-filtered reply text and covers the panel's half: markdown
// rendering and history hydration must show the commands exactly, once.
test.describe(
  'Cloud Agent panel renders local command replies exactly',
  {
    tag: ['@cloud', '@agent', '@ui'],
    annotation: {
      type: 'source',
      description:
        'https://linear.app/comfyorg/issue/BE-24631/agent-on-cloud-remaining-ways-the-reply-filter-breaks-commands-users'
    }
  },
  () => {
    test('keeps exact user-local commands visible after history hydration', async ({
      agentPanel,
      promptHistory,
      workflowSelection
    }) => {
      const replyText = [
        'Run these on your own machine:',
        '',
        '- `cd ~/ComfyUI/models`',
        '- `comfy node install x`',
        '- `huggingface-cli download black-forest-labs/FLUX.1-dev`',
        '- Use `flux-2-klein-9B.safetensors`.',
        '- Use `flux1-dev-Q4_K_M.gguf`.',
        '- Keep the `non-turbo` variant.'
      ].join('\n')

      await test.step('receive a reply with commands for the user machine', async () => {
        await agentPanel.open()
        await agentPanel.chooseWorkflow()
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
        workflowSelection.finishSave(true)
        await agentPanel.sendMessage('Show me the local setup commands.')
        await expect.poll(() => promptHistory.requests.length).toBe(1)
        await promptHistory.finishLatestTurn(replyText, 0)
      })

      await test.step('show every affected command and model name exactly', async () => {
        const reply = agentPanel.root.getByTestId('markdown-stream').last()
        await expect(reply).toBeVisible()
        await expect(
          reply.getByText('cd ~/ComfyUI/models', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText('comfy node install x', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText(
            'huggingface-cli download black-forest-labs/FLUX.1-dev',
            { exact: true }
          )
        ).toBeVisible()
        await expect(
          reply.getByText('flux-2-klein-9B.safetensors', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText('flux1-dev-Q4_K_M.gguf', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText('non-turbo', { exact: true })
        ).toBeVisible()
      })

      let repliesBeforeReload = 0
      await test.step('reload the panel from persisted history', async () => {
        repliesBeforeReload = await agentPanel.root
          .getByTestId('markdown-stream')
          .count()
        const historyReadsBeforeReload = promptHistory.historyReads()
        await agentPanel.reload()
        await expect
          .poll(() => promptHistory.historyReads())
          .toBeGreaterThan(historyReadsBeforeReload)
      })

      await test.step('keep the hydrated reply text exact', async () => {
        await expect(
          agentPanel.root.getByTestId('markdown-stream')
        ).toHaveCount(repliesBeforeReload)
        const reply = agentPanel.root.getByTestId('markdown-stream').last()
        await expect(reply).toBeVisible()
        await expect(
          reply.getByText('cd ~/ComfyUI/models', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText('comfy node install x', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText(
            'huggingface-cli download black-forest-labs/FLUX.1-dev',
            { exact: true }
          )
        ).toBeVisible()
        await expect(
          reply.getByText('flux-2-klein-9B.safetensors', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText('flux1-dev-Q4_K_M.gguf', { exact: true })
        ).toBeVisible()
        await expect(
          reply.getByText('non-turbo', { exact: true })
        ).toBeVisible()
      })
    })
  }
)

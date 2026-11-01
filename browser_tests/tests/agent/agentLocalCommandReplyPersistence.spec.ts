import { expect } from '@playwright/test'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Cloud Agent reply rendering and persistence',
  {
    tag: ['@cloud', '@agent', '@ui'],
    annotation: {
      type: 'source',
      description:
        'https://linear.app/comfyorg/issue/BE-24631/agent-on-cloud-remaining-ways-the-reply-filter-breaks-commands-users'
    }
  },
  () => {
    test('keeps exact server reply text through streaming and history hydration', async ({
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
        await promptHistory.streamLatestTurn(replyText)
      })

      await test.step('show every affected string exactly while streaming', async () => {
        const replies = agentPanel.root.getByTestId('markdown-stream')
        await expect(replies).toHaveCount(1)
        const reply = replies.first()
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

      await test.step('persist and finish one copy of the reply', async () => {
        await promptHistory.persistAndFinishLatestTurn(replyText, 0)
        await expect(
          agentPanel.root.getByTestId('markdown-stream')
        ).toHaveCount(1)
      })

      await test.step('reload the panel from persisted history', async () => {
        const historyReadsBeforeReload = promptHistory.historyReads()
        await agentPanel.reload()
        await expect
          .poll(() => promptHistory.historyReads())
          .toBeGreaterThan(historyReadsBeforeReload)
      })

      await test.step('keep the hydrated reply text exact', async () => {
        const replies = agentPanel.root.getByTestId('markdown-stream')
        await expect(replies).toHaveCount(1)
        const reply = replies.first()
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

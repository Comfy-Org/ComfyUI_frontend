import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'

import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import { api } from '@/scripts/api'

import DeploySetupCard from './DeploySetupCard.vue'

/** Deploy your setup, on local ComfyUI when Comfy Cloud lacks a node pack. */
const meta: Meta<typeof DeploySetupCard> = {
  title: 'Platform/OpenOnCloud/DeploySetupCard',
  component: DeploySetupCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    videoSources: DEPLOY_VIDEO_SOURCES,
    posterSrc: DEPLOY_VIDEO_POSTER_SRC,
    onDone: fn(),
    onDismiss: fn()
  }
}

export default meta
type Story = StoryObj<typeof meta>

function reportLocalAgent(state: 'ready' | 'off') {
  api.serverFeatureFlags.value = {
    ...api.serverFeatureFlags.value,
    agent: state === 'ready' ? { state } : undefined
  }
}

function withLocalAgent(state: 'ready' | 'off', rows: string[]): Story {
  return {
    beforeEach: () => reportLocalAgent(state),
    play: async ({ canvas, canvasElement, userEvent }) => {
      await userEvent.click(canvas.getByTestId('deploy-setup-agent'))
      const menu = within(canvasElement.ownerDocument.body)
      await expect(
        (await menu.findAllByRole('menuitem')).map((row) =>
          row.textContent.trim()
        )
      ).toEqual(rows)
    }
  }
}

export const LocalAgentReady = withLocalAgent('ready', [
  'Use local agent',
  'Open in Claude desktop',
  'Open in ChatGPT desktop',
  'Copy prompt'
])

export const NoLocalAgent = withLocalAgent('off', [
  'Open in Claude desktop',
  'Open in ChatGPT desktop',
  'Copy prompt'
])

export const PromptCopied: Story = {
  beforeEach: () => reportLocalAgent('ready'),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByTestId('deploy-setup-agent'))
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
        name: 'Copy prompt'
      })
    )
    await expect(canvas.getByTestId('deploy-setup-agent')).toHaveTextContent(
      'Copied'
    )
  }
}

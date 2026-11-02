import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { ExtensionChangePart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import ExtensionChangeCard from './ExtensionChangeCard.vue'

function renderCard(part: Partial<ExtensionChangePart>) {
  return render(ExtensionChangeCard, {
    props: {
      part: {
        type: 'extensionChange',
        action: 'disabled',
        pack: 'comfy-cushions',
        agentCreated: false,
        restartRequired: true,
        ...part
      }
    },
    global: { plugins: [i18n] }
  })
}

describe('ExtensionChangeCard', () => {
  it.for([
    {
      action: 'disabled',
      pack: "Alice's A&B-pack",
      text: "Turned off the node pack Alice's A&B-pack"
    },
    {
      action: 'enabled',
      pack: 'comfy-cushions',
      text: 'Turned on the node pack comfy-cushions'
    },
    {
      action: 'removed',
      pack: 'comfy-cushions',
      text: 'Removed the node pack comfy-cushions'
    }
  ] as const)('names the pack it $action', ({ action, pack, text }) => {
    renderCard({ action, pack })

    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it('says a restart is needed only when it is', () => {
    const { unmount } = renderCard({ restartRequired: true })
    expect(screen.getByRole('status')).toHaveTextContent(
      'This takes effect after ComfyUI restarts.'
    )
    unmount()

    renderCard({ restartRequired: false })
    expect(screen.getByRole('status')).not.toHaveTextContent('restarts')
  })

  it('marks a pack the agent made', () => {
    renderCard({ action: 'removed', agentCreated: true })

    expect(screen.getByRole('status')).toHaveTextContent('Created by agent')
  })

  it('does not claim the agent made a pack it did not', () => {
    renderCard({ agentCreated: false })

    expect(screen.getByRole('status')).not.toHaveTextContent('Created by agent')
  })
})

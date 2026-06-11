import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionSuccessWorkspace from './SubscriptionSuccessWorkspace.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => String(value)
  })
}))

function renderCard() {
  return render(SubscriptionSuccessWorkspace, {
    props: {
      tierKey: 'standard',
      previewData: {
        new_plan: { price_cents: 1600 }
      } as unknown as PreviewSubscribeResponse
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: {
          template: '<button @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('SubscriptionSuccessWorkspace', () => {
  it('renders the all-set heading and plan price', () => {
    renderCard()
    expect(screen.getByText('subscription.success.allSet')).toBeTruthy()
    expect(screen.getByText('$16')).toBeTruthy()
  })

  it('emits close when the close button is clicked', async () => {
    const { emitted } = renderCard()
    await userEvent.click(screen.getByRole('button'))
    expect(emitted().close).toBeTruthy()
  })
})

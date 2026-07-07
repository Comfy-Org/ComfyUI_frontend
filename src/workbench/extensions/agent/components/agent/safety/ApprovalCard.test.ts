import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { ApprovalCard as ApprovalCardModel } from './safetyTypes'

import ApprovalCard from './ApprovalCard.vue'

const base = {
  approvalId: 'a1',
  turnId: 't1',
  tool: 'spend_credits',
  summary: 'Generate 4 images (8 credits)',
  outcome: null
}

function mount(card: ApprovalCardModel) {
  return render(ApprovalCard, { props: { card }, global: { plugins: [i18n] } })
}

describe('ApprovalCard (non-optimistic)', () => {
  it('emits answer on Approve but does not itself flip to approved', async () => {
    const { emitted } = mount({ ...base, status: 'open' })
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(emitted().answer[0]).toEqual(['a1', true])
    // Still shows the live buttons — the card only resolves on the server's approval_closed.
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.queryByText('approved')).toBeNull()
  })

  it('shows a waiting state with no action buttons once answered', () => {
    mount({ ...base, status: 'waiting' })
    expect(screen.getByText('Waiting for approval...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('shows the terminal outcome once resolved', () => {
    mount({ ...base, status: 'resolved', outcome: 'approved' })
    expect(screen.getByText('approved')).toBeInTheDocument()
  })
})

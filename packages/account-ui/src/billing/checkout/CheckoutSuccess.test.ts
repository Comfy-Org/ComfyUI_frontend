import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import CheckoutSuccess from './CheckoutSuccess.vue'
import { creatorPlan, successCopy, teamPlan } from './__fixtures__/copy'
import { exactPreview, plan } from './__fixtures__/preview'

type Props = InstanceType<typeof CheckoutSuccess>['$props']

function renderSuccess(props: Partial<Props> = {}, slots = {}) {
  return render(CheckoutSuccess, {
    props: { plan: creatorPlan, copy: successCopy, locale: 'en', ...props },
    slots
  })
}

describe('CheckoutSuccess', () => {
  it.for([
    [
      'the quoted monthly price and monthly credits',
      {
        previewData: exactPreview({
          new_plan: plan('CREATOR', 'MONTHLY', 3500)
        })
      },
      ['$35', 'USD / mo', '7,400 / month']
    ],
    [
      'the quoted annual total and the year of credits',
      {
        previewData: exactPreview({
          new_plan: plan('CREATOR', 'ANNUAL', 33_600)
        })
      },
      ['$336', 'USD / year', '88,800 / year']
    ],
    [
      'a team stop at its own yearly total without a quote',
      { plan: teamPlan, billingCycle: 'yearly' },
      ['$15960', 'USD / year', '1,772,400 / year']
    ],
    ['a zero price for a tier plan with no quote', {}, ['$0']]
  ] as const)('shows %s', ([, props, texts]) => {
    renderSuccess(props)
    for (const text of texts) expect(screen.getByText(text)).toBeTruthy()
  })

  it('confirms the promotion that was applied', () => {
    renderSuccess({
      promoApplied: {
        code: 'SPRING',
        renewalAmount: '$30.00',
        renewalDate: 'Jul 19, 2026'
      }
    })
    expect(screen.getByText('SPRING applied.')).toBeTruthy()
  })

  it('closes from a secondary Close action by default', async () => {
    const onClose = vi.fn()
    renderSuccess({ onClose })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders the host follow-up ahead of a demoted Close', () => {
    renderSuccess(
      { closeDemoted: true },
      {
        details: '<p>Invite your team</p>',
        actions: '<button>Send invites</button>'
      }
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.textContent.trim())).toEqual([
      'Send invites',
      'Close'
    ])
    expect(screen.getByText('Invite your team')).toBeTruthy()
  })
})

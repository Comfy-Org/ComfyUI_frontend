import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BillingAutoTopUpMemberBlock from './BillingAutoTopUpMemberBlock.vue'
import { autoTopUpMemberBlockCopy } from './__fixtures__/autoTopUpCopy'

describe('BillingAutoTopUpMemberBlock', () => {
  it('tells a member who manages auto top-up, in the host style', () => {
    render(BillingAutoTopUpMemberBlock, {
      props: {
        copy: autoTopUpMemberBlockCopy,
        classes: { root: 'host-root' }
      }
    })

    expect(screen.getByRole('heading', { name: 'Auto top-up' })).toBeTruthy()
    expect(
      screen.getByText(
        'Credits can top up automatically when they run low. Contact a workspace owner to manage this.'
      )
    ).toBeTruthy()
    expect(
      screen.getByTestId('billing-auto-top-up-member-card').className
    ).toContain('host-root')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

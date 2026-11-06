import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BillingAutoTopUpMemberBlock from './BillingAutoTopUpMemberBlock.vue'
import {
  autoTopUpMemberBlockCopy,
  memberView
} from './__fixtures__/autoTopUpCopy'

const CONTACT = 'Contact a workspace owner to manage this.'

describe('BillingAutoTopUpMemberBlock', () => {
  it('tells a member who manages auto top-up, in the host style', () => {
    render(BillingAutoTopUpMemberBlock, {
      props: {
        copy: autoTopUpMemberBlockCopy,
        locale: 'en',
        classes: { root: 'host-root' }
      }
    })

    expect(screen.getByRole('heading', { name: 'Auto top-up' })).toBeTruthy()
    expect(
      screen.getByText(
        `Credits can top up automatically when they run low. ${CONTACT}`
      )
    ).toBeTruthy()
    expect(screen.queryByTestId('billing-auto-top-up-status')).toBeNull()
    expect(
      screen.getByTestId('billing-auto-top-up-member-card').className
    ).toContain('host-root')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the served status and its line without any controls', () => {
    render(BillingAutoTopUpMemberBlock, {
      props: {
        copy: autoTopUpMemberBlockCopy,
        locale: 'en',
        view: memberView({ status: 'failed' })
      }
    })

    const status = screen.getByTestId('billing-auto-top-up-status')
    expect(status.textContent.trim()).toBe('Failed')
    expect(
      screen.getByText(`The last top-up didn't go through. ${CONTACT}`)
    ).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })
})

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import LocalAgentCreditNotice from './LocalAgentCreditNotice.vue'

describe('LocalAgentCreditNotice', () => {
  it('offers free chat and a documentation link without amount or expiry claims', () => {
    render(LocalAgentCreditNotice, {
      props: { kind: 'free' },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('note', { name: 'Agent credits' })
    ).toHaveTextContent(/^Try agent chat for free Learn more$/)
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      'https://docs.comfy.org/agent-tools/in-app-agent'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers a neutral purchase action without claiming the balance is exhausted', async () => {
    const { emitted } = render(LocalAgentCreditNotice, {
      props: { kind: 'credits', canTopUp: true },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('note', { name: 'Agent credits' })
    ).toHaveTextContent(/^Agent chats use credits\. Add credits$/)
    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

    expect(emitted('addCredits')).toEqual([[]])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('preserves the explanation without an unavailable purchase action', () => {
    render(LocalAgentCreditNotice, {
      props: { kind: 'credits', canTopUp: false },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('note', { name: 'Agent credits' })
    ).toHaveTextContent(/^Agent chats use credits\.$/)
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
  })
})

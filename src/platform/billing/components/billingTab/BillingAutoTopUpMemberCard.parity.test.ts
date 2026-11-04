import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { BillingAutoTopUpMemberBlock as PackageMemberBlock } from '@comfyorg/account-ui/billing'
import type { AutoTopUpMemberBlockCopy } from '@comfyorg/account-ui/billing'

import enMessages from '@/locales/en/main.json'

import AppMemberCard from './BillingAutoTopUpMemberCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t

const copy: AutoTopUpMemberBlockCopy = {
  title: t('workspacePanel.billingTab.autoTopUp.title'),
  body: t('workspacePanel.billingTab.autoTopUp.member')
}

function readBlock() {
  const block = screen.getByTestId('billing-auto-top-up-member-card')
  return {
    heading: screen.getByRole('heading').textContent.trim(),
    text: block.textContent.trim(),
    className: block.className,
    controls: screen.queryAllByRole('button').length
  }
}

describe('account-ui BillingAutoTopUpMemberBlock parity with the app member card', () => {
  it('renders the same title, body and no actions', () => {
    const app = render(AppMemberCard, { global: { plugins: [i18n] } })
    const appBlock = readBlock()
    app.unmount()

    render(PackageMemberBlock, { props: { copy } })

    expect(readBlock()).toEqual(appBlock)
  })
})

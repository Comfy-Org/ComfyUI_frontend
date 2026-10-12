import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { i18n as appI18n } from '@/i18n'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

import ApiNodesSignInContent from './ApiNodesSignInContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: enMessages.g,
      apiNodesSignInDialog: enMessages.apiNodesSignInDialog
    }
  }
})

function renderContent(props: {
  apiNodeNames: string[]
  onLogin?: () => void
  onCancel?: () => void
}) {
  return render(ApiNodesSignInContent, {
    props: { titleId: 'api-nodes-signin', ...props },
    global: { plugins: [i18n] }
  })
}

describe('ApiNodesSignInContent', () => {
  beforeEach(() => {
    useNodeDefStore().nodeDefsByName = {}
  })

  it('lists partner nodes with display names, falling back to raw names', () => {
    useNodeDefStore().nodeDefsByName = {
      PartnerA: new ComfyNodeDefImpl({
        name: 'PartnerA',
        display_name: 'Partner A',
        category: '',
        python_module: '',
        description: '',
        output_node: false
      })
    }
    renderContent({ apiNodeNames: ['PartnerA', 'UnknownNode'] })

    expect(screen.getByText('Partner A')).toBeInTheDocument()
    expect(screen.getByText('UnknownNode')).toBeInTheDocument()
  })

  it('omits the node list section when no names are known', () => {
    renderContent({ apiNodeNames: [] })
    expect(
      screen.queryByText('Partner nodes in this workflow')
    ).not.toBeInTheDocument()
  })

  it.for([
    {
      locale: 'en',
      href: 'https://docs.comfy.org/tutorials/api-nodes/faq'
    },
    {
      locale: 'zh',
      href: 'https://docs.comfy.org/zh/tutorials/api-nodes/faq'
    }
  ] as const)(
    'links to the partner nodes docs for $locale',
    ({ locale, href }) => {
      vi.spyOn(appI18n.global.locale, 'value', 'get').mockReturnValue(locale)
      renderContent({ apiNodeNames: [] })
      const link = screen.getByRole('link', {
        name: /What are partner nodes\?/
      })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  )

  it('invokes onLogin from the Sign In button', async () => {
    const onLogin = vi.fn()
    renderContent({ apiNodeNames: ['PartnerA'], onLogin })

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(onLogin).toHaveBeenCalledExactlyOnceWith()
  })

  it('dismisses via the close button', async () => {
    const onCancel = vi.fn()
    renderContent({ apiNodeNames: ['PartnerA'], onCancel })

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onCancel).toHaveBeenCalledExactlyOnceWith()
  })

  it('names the dialog for assistive technology', () => {
    renderContent({ apiNodeNames: [] })

    expect(
      screen.getByRole('heading', { name: 'Sign in to run partner nodes' })
    ).toHaveAttribute('id', 'api-nodes-signin')
  })
})

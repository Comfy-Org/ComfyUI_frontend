import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ApiNodesSignInContent from './ApiNodesSignInContent.vue'

const hoisted = vi.hoisted(() => ({
  nodeDefsByName: {} as Record<string, { display_name?: string }>
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: hoisted.nodeDefsByName })
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      apiNodesSignInDialog: {
        title: 'Sign in to run partner nodes',
        message: 'Partner nodes run on third-party services.',
        partnerNodesInWorkflow: 'Partner nodes in this workflow',
        whatArePartnerNodes: 'What are partner nodes?',
        signIn: 'Sign In'
      }
    }
  }
})

function renderContent(props: {
  apiNodeNames: string[]
  onLogin?: () => void
}) {
  return render(ApiNodesSignInContent, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('ApiNodesSignInContent', () => {
  beforeEach(() => {
    hoisted.nodeDefsByName = {}
  })

  it('lists partner nodes with display names, falling back to raw names', () => {
    hoisted.nodeDefsByName = {
      PartnerA: { display_name: 'Partner A' }
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

  it('links to the partner nodes docs', () => {
    renderContent({ apiNodeNames: [] })
    const link = screen.getByRole('link', {
      name: /What are partner nodes\?/
    })
    expect(link).toHaveAttribute(
      'href',
      'https://docs.comfy.org/tutorials/api-nodes/faq'
    )
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('invokes onLogin from the Sign In button', async () => {
    const onLogin = vi.fn()
    renderContent({ apiNodeNames: ['PartnerA'], onLogin })

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(onLogin).toHaveBeenCalled()
  })
})

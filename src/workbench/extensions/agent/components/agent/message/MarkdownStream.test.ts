// @vitest-environment jsdom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// jsdom lacks ResizeObserver, which the asset-preview import chain references.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
})

import { i18n } from '@/i18n'

import MarkdownStream from './MarkdownStream.vue'

describe('MarkdownStream', () => {
  it('renders markdown prose', () => {
    render(MarkdownStream, { props: { text: '**bold**' } })
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument()
  })

  it('renders empty text without error or content', () => {
    const { container } = render(MarkdownStream, { props: { text: '' } })
    expect(container.textContent).toBe('')
  })

  it('renders the complete asset URL as the link text and target', () => {
    const assetUrl =
      'https://cloud.comfy.org/api/view?filename=ComfyUI_00001_32f6b8c7.png&subfolder=agent%2Foutputs&type=output'
    render(MarkdownStream, {
      props: { text: `[${assetUrl}](${assetUrl})` }
    })
    const expectedUrl = assetUrl.replace(
      'https://cloud.comfy.org',
      window.location.origin
    )
    expect(screen.getByRole('link', { name: expectedUrl })).toHaveAttribute(
      'href',
      expectedUrl
    )
  })

  it('preserves a filename label supplied for an asset link', () => {
    const assetUrl =
      'https://cloud.comfy.org/api/view?filename=ComfyUI_00070_.png&type=output'
    render(MarkdownStream, {
      props: { text: `[ComfyUI_00070_.png](${assetUrl})` }
    })

    expect(
      screen.getByRole('link', { name: 'ComfyUI_00070_.png' })
    ).toHaveAttribute(
      'href',
      assetUrl.replace('https://cloud.comfy.org', window.location.origin)
    )
  })

  // FE-1326 superseded the FE-1328 list rendering for multiple assets: the
  // DES-530 per-count clickable grid replaces the list of links.
  it('groups multiple asset links into the clickable preview grid', () => {
    const contactUrl = 'https://cloud.comfy.org/api/view?filename=contact.png'
    const fluxUrl = 'https://cloud.comfy.org/api/view?filename=flux.png'
    render(MarkdownStream, {
      props: {
        text: [
          `- [${contactUrl}](${contactUrl})`,
          `- [${fluxUrl}](${fluxUrl})`
        ].join('\n')
      },
      global: { plugins: [i18n] }
    })

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'contact.png' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'flux.png' })).toBeInTheDocument()
  })

  it('keeps asset previews when the message re-renders', () => {
    const assetUrl = 'https://cloud.comfy.org/api/view?filename=a.png'
    const text = `![gen](${assetUrl})`
    const first = render(MarkdownStream, {
      props: { text },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('img', { name: 'gen' })).toBeInTheDocument()
    first.unmount()

    render(MarkdownStream, { props: { text }, global: { plugins: [i18n] } })
    expect(screen.getByRole('img', { name: 'gen' })).toBeInTheDocument()
  })

  it('opens the inspect view when a prose image is clicked', async () => {
    const assetUrl = 'https://cloud.comfy.org/api/view?filename=a.png'
    render(MarkdownStream, {
      props: { text: `Look at ![gen](${assetUrl}) closely` },
      global: {
        stubs: {
          MediaLightbox: {
            props: ['allGalleryItems', 'activeIndex'],
            template:
              '<div data-testid="lightbox" :data-active="activeIndex" />'
          }
        }
      }
    })

    await userEvent.click(screen.getByRole('img', { name: 'gen' }))

    expect(screen.getByTestId('lightbox').dataset.active).toBe('0')
  })

  it('preserves the asset preview when the response uses markdown image syntax', () => {
    const assetUrl =
      'https://cloud.comfy.org/api/view?filename=ComfyUI_00001_32f6b8c7.png&subfolder=agent%2Foutputs&type=output'
    render(MarkdownStream, {
      props: { text: `![Generated asset](${assetUrl})` },
      global: { plugins: [i18n] }
    })

    const image = screen.getByRole('img', { name: 'Generated asset' })
    expect(image).toHaveAttribute(
      'src',
      assetUrl.replace('https://cloud.comfy.org', window.location.origin)
    )
  })

  it('strips a script tag (XSS guard)', () => {
    const { html } = render(MarkdownStream, {
      props: { text: 'hi <script>alert(1)</script> there' }
    })
    expect(html()).not.toContain('<script')
    expect(screen.getByText(/hi/)).toBeInTheDocument()
  })

  it('opens links in a new tab with rel=noopener', () => {
    render(MarkdownStream, { props: { text: '[docs](https://example.com)' } })
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('drops a javascript: url', () => {
    const { html } = render(MarkdownStream, {
      props: { text: '[x](javascript:alert(1))' }
    })
    expect(html()).not.toContain('javascript:')
  })

  it('renders a fenced block as a framed code block with its language and a copy button', () => {
    render(MarkdownStream, {
      props: { text: 'before\n```python\nprint("hi")\n```\nafter' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(
      screen.getByText('print("hi")', { selector: 'code' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByText('before')).toBeInTheDocument()
    expect(screen.getByText('after')).toBeInTheDocument()
  })

  it('handles a 4-backtick fence containing a 3-backtick fence', () => {
    render(MarkdownStream, {
      props: { text: '````md\n```js\ncode\n```\n````' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText(/```js/, { selector: 'code' })).toBeInTheDocument()
    expect(screen.getByText('md')).toBeInTheDocument()
  })

  it('leaves an inline triple-backtick span mid-sentence as prose', () => {
    render(MarkdownStream, {
      props: { text: 'use ```npm i``` to install' }
    })
    expect(screen.getByText('npm i', { selector: 'code' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('keeps a 4-space-indented block as prose-rendered code, not a framed block', () => {
    render(MarkdownStream, {
      props: { text: 'steps:\n\n    npm install\n\ndone' },
      global: { plugins: [i18n] }
    })
    expect(
      screen.getByText('npm install', { selector: 'code' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('labels a fence by the first word of its info string', () => {
    render(MarkdownStream, {
      props: { text: '```python title=x\nprint("hi")\n```' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.queryByText(/title=x/)).not.toBeInTheDocument()
  })

  it('labels a bare fence with no language as text', () => {
    render(MarkdownStream, {
      props: { text: '```\nplain body\n```' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByText('text')).toBeInTheDocument()
    expect(
      screen.getByText('plain body', { selector: 'code' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })
})

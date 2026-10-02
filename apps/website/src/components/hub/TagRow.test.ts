import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import TagRow from './TagRow.vue'

// happy-dom lays nothing out, so the row measures 0 and never overflows.
function stubWidths(row: number, chip: number) {
  for (const [name, value] of [
    ['clientWidth', row],
    ['offsetWidth', chip]
  ] as const)
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get: () => value
    })
}

describe('TagRow', () => {
  afterEach(() => {
    for (const name of ['clientWidth', 'offsetWidth'])
      Reflect.deleteProperty(HTMLElement.prototype, name)
  })

  it('links its chips to the tag pages by default', () => {
    render(TagRow, { props: { tags: ['upscale'] } })
    expect(screen.getByRole('link', { name: /upscale/i })).toBeTruthy()
  })

  it('renders plain chips when the card around it is already a link', () => {
    render(TagRow, { props: { tags: ['upscale'], linkTags: false } })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByTestId('tag-row').textContent).toMatch(/upscale/i)
  })

  it.for([
    { tag: 'edit', label: 'Edit' },
    { tag: 'text-to-image', label: 'Text to Image' },
    { tag: 'bfl', label: 'BFL' },
    { tag: 'byteplus', label: 'BytePlus' },
    { tag: 'seedream-5-pro', label: 'Seedream 5 Pro' }
  ])(
    'formats $tag as $label when title case is requested',
    ({ tag, label }) => {
      render(TagRow, { props: { tags: [tag], titleCaseLabels: true } })
      expect(screen.getByRole('link', { name: label })).toBeTruthy()
    }
  )

  it('uses the formatted labels in the overflow menu accessible name', () => {
    render(TagRow, {
      props: {
        tags: ['edit', 'llm'],
        collapseTags: true,
        titleCaseLabels: true
      }
    })
    expect(screen.getByRole('button', { name: 'Edit, LLM' })).toBeTruthy()
  })

  it('names the tags it hides on a chip the keyboard can reach', async () => {
    stubWidths(120, 100)
    render(TagRow, { props: { tags: ['upscale', 'inpaint', 'controlnet'] } })
    await nextTick()
    await nextTick()

    const overflow = screen.getByTestId('tag-overflow')
    expect(overflow.tagName).toBe('BUTTON')
    expect(overflow.getAttribute('aria-label')).toMatch(/controlnet/i)
  })

  it('keeps tags in the overflow menu when collapsed even on a wide card', async () => {
    stubWidths(1000, 100)
    render(TagRow, {
      props: {
        tags: ['upscale', 'inpaint', 'controlnet'],
        linkTags: false,
        collapseTags: true
      }
    })
    await nextTick()
    await nextTick()

    const overflow = screen.getByRole('button', {
      name: /upscale.*inpaint.*controlnet/i
    })
    expect(overflow.textContent.trim()).toBe('+3')
    expect(screen.queryByRole('link')).toBeNull()
  })
})

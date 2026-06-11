import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MiddleTruncate from './MiddleTruncate.vue'
import * as overflow from './isTextOverflowing'

function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect
    }) as DOMRect
}

describe('MiddleTruncate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the full text inline', () => {
    render(MiddleTruncate, { props: { text: 'KSampler' } })
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('does not reveal a tooltip when the text fits', async () => {
    vi.spyOn(overflow, 'isTextOverflowing').mockReturnValue(false)
    render(MiddleTruncate, { props: { text: 'KSampler' } })
    await userEvent.hover(screen.getByText('KSampler'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('reveals the full text on hover when truncated', async () => {
    vi.spyOn(overflow, 'isTextOverflowing').mockReturnValue(true)
    const longName = 'ONNX Detector (SEGS/legacy) - use BBOXDetector'
    render(MiddleTruncate, { props: { text: longName } })
    const el = screen.getByText(longName)
    stubRect(el, { left: 10, top: 20, width: 100, height: 20 })
    await userEvent.hover(el)
    expect(screen.getByRole('tooltip')).toHaveTextContent(longName)
  })

  it('reveals when hovering anywhere on the parent menu item', async () => {
    vi.spyOn(overflow, 'isTextOverflowing').mockReturnValue(true)
    const longName = 'ONNX Detector (SEGS/legacy) - use BBOXDetector'
    render({
      components: { MiddleTruncate },
      template: `<div role="menuitem"><MiddleTruncate text="${longName}" /></div>`
    })
    stubRect(screen.getByText(longName), {
      left: 10,
      top: 20,
      width: 120,
      height: 20
    })
    await userEvent.hover(screen.getByRole('menuitem'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(longName)
  })

  it('sizes the reveal to the parent menu item height', async () => {
    vi.spyOn(overflow, 'isTextOverflowing').mockReturnValue(true)
    const nodeName = 'A long truncated node name'
    render({
      components: { MiddleTruncate },
      template: `<div role="menuitem"><MiddleTruncate text="${nodeName}" /></div>`
    })
    stubRect(screen.getByText(nodeName), {
      left: 10,
      top: 20,
      width: 100,
      height: 20
    })
    stubRect(screen.getByRole('menuitem'), {
      left: 0,
      top: 10,
      right: 200,
      width: 200,
      height: 36
    })
    await userEvent.hover(screen.getByText(nodeName))
    expect(screen.getByRole('tooltip')).toHaveStyle({ height: '36px' })
  })
})

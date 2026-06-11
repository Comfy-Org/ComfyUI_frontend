import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1024
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(document.documentElement, 'clientWidth')
  })

  it('renders the full text inline', () => {
    render(MiddleTruncate, { props: { text: 'KSampler' } })
    expect(screen.getByText('KSampler')).toBeInTheDocument()
  })

  it('does not reveal a tooltip when the text fits', async () => {
    vi.spyOn(overflow, 'measureTextWidth').mockReturnValue(0)
    render(MiddleTruncate, { props: { text: 'KSampler' } })
    await userEvent.hover(screen.getByText('KSampler'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('reveals the full text on hover when truncated', async () => {
    vi.spyOn(overflow, 'measureTextWidth').mockReturnValue(500)
    const longName = 'ONNX Detector (SEGS/legacy) - use BBOXDetector'
    render(MiddleTruncate, { props: { text: longName } })
    const el = screen.getByText(longName)
    stubRect(el, { left: 10, top: 20, width: 100, height: 20 })
    await userEvent.hover(el)
    expect(screen.getByRole('tooltip')).toHaveTextContent(longName)
  })

  it('reveals when hovering anywhere on the parent menu item', async () => {
    vi.spyOn(overflow, 'measureTextWidth').mockReturnValue(500)
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
    vi.spyOn(overflow, 'measureTextWidth').mockReturnValue(500)
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

  it('anchors the reveal to the left when it fits to the right', async () => {
    vi.spyOn(overflow, 'measureTextWidth').mockReturnValue(50)
    const nodeName = 'Fits To The Right'
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
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '10px' })
  })

  it('flips to a right anchor when revealing rightward would overflow', async () => {
    vi.spyOn(overflow, 'measureTextWidth').mockReturnValue(600)
    const nodeName = 'A very long node name near the right edge'
    render({
      components: { MiddleTruncate },
      template: `<div role="menuitem" style="padding-right: 16px"><MiddleTruncate text="${nodeName}" /></div>`
    })
    stubRect(screen.getByText(nodeName), {
      left: 850,
      top: 20,
      width: 150,
      height: 20
    })
    stubRect(screen.getByRole('menuitem'), {
      left: 840,
      top: 10,
      right: 1000,
      width: 160,
      height: 36
    })
    await userEvent.hover(screen.getByText(nodeName))
    const tooltip = screen.getByRole('tooltip')
    // Anchored to the item's right edge (1024 - 1000), independent of its padding.
    expect(tooltip).toHaveStyle({ right: '24px' })
    expect(tooltip).not.toHaveStyle({ left: '850px' })
  })
})

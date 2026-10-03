import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import CopyTextButton from './CopyTextButton.vue'

const props = { value: 'example code', label: 'Copy', copiedLabel: 'Copied' }

describe('CopyTextButton', () => {
  it.for([true, false])(
    'reports a fallback copy only when it succeeds: %s',
    async (succeeded) => {
      const visitor = userEvent.setup()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new DOMException('Denied', 'NotAllowedError')
      )
      const previous = Object.getOwnPropertyDescriptor(document, 'execCommand')
      const fallback = vi.fn(() => succeeded)
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: fallback
      })
      onTestFinished(() => {
        if (previous) Object.defineProperty(document, 'execCommand', previous)
        else Reflect.deleteProperty(document, 'execCommand')
      })
      const { emitted } = render(CopyTextButton, { props })

      await visitor.click(screen.getByRole('button', { name: 'Copy' }))

      expect(fallback).toHaveBeenCalledWith('copy')
      expect(emitted('copied')).toEqual(succeeded ? [[]] : undefined)
      expect(
        screen
          .getByRole('button', { name: 'Copy' })
          .textContent.includes('Copied')
      ).toBe(succeeded)
      expect(screen.queryByRole('textbox')).toBeNull()
    }
  )

  it('reports each completed clipboard write, never the pending click', async () => {
    const visitor = userEvent.setup()
    const pending = Promise.withResolvers<void>()
    const write = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(undefined)
    const { emitted } = render(CopyTextButton, { props })
    const button = screen.getByRole('button', { name: 'Copy' })

    await visitor.click(button)
    expect(emitted('copied')).toBeUndefined()
    expect(button).not.toHaveTextContent('Copied')
    pending.resolve()
    await waitFor(() => expect(emitted('copied')).toEqual([[]]))
    expect(write).toHaveBeenCalledWith(props.value)

    await visitor.click(button)
    expect(emitted('copied')).toEqual([[], []])
  })

  it('does not report success or show Copied after a denied write', async () => {
    const visitor = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError')
    )
    const { emitted } = render(CopyTextButton, { props })

    await visitor.click(screen.getByRole('button', { name: 'Copy' }))

    expect(emitted('copied')).toBeUndefined()
    expect(screen.queryAllByText('Copied')).toHaveLength(0)
  })

  it('does not report success when clipboard access is unavailable', async () => {
    const visitor = userEvent.setup()
    vi.stubGlobal('navigator', { clipboard: undefined })
    const { emitted } = render(CopyTextButton, { props })

    await visitor.click(screen.getByRole('button', { name: 'Copy' }))

    expect(emitted('copied')).toBeUndefined()
    expect(screen.queryAllByText('Copied')).toHaveLength(0)
  })
})

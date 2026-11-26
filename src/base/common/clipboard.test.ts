import { screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { writeClipboardText } from './clipboard'

describe('writeClipboardText', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied'))
      }
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true)
    })
    return () => {
      Reflect.deleteProperty(document, 'execCommand')
    }
  })

  it.for(['hello', '', 'email\thttps://example.com/?invite=token\n日本語'])(
    'writes %j through the Clipboard API without a fallback',
    async (text) => {
      vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined)

      await expect(writeClipboardText(text)).resolves.toBe(true)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text)
      expect(document.execCommand).not.toHaveBeenCalled()
      expect(screen.queryByRole('textbox')).toBeNull()
    }
  )

  it('copies from a read-only textarea and removes it after the fallback', async () => {
    vi.mocked(document.execCommand).mockImplementation(() => {
      expect(screen.getByRole('textbox')).toHaveProperty('value', 'hello')
      expect(screen.getByRole('textbox')).toHaveProperty('readOnly', true)
      return true
    })

    await expect(writeClipboardText('hello')).resolves.toBe(true)

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('uses the fallback when the Clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })

    await expect(writeClipboardText('hello')).resolves.toBe(true)

    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it.for([
    { name: 'returns false', copy: () => false },
    {
      name: 'throws',
      copy: () => {
        throw new Error('copy unavailable')
      }
    }
  ])(
    'reports failure and removes the textarea when the fallback $name',
    async ({ copy }) => {
      vi.mocked(document.execCommand).mockImplementation(copy)

      await expect(writeClipboardText('hello')).resolves.toBe(false)

      expect(screen.queryByRole('textbox')).toBeNull()
    }
  )

  it('reports failure without leaking a textarea when selection throws', async () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(() => {
      throw new Error('selection unavailable')
    })

    await expect(writeClipboardText('hello')).resolves.toBe(false)

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('reports failure and removes the textarea when execCommand is unavailable', async () => {
    Reflect.deleteProperty(document, 'execCommand')

    await expect(writeClipboardText('hello')).resolves.toBe(false)

    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

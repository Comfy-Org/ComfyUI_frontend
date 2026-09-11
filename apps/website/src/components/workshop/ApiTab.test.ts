// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { buildSnippet } from '../../config/models-snippets'
import { workshopContract } from '../../config/workshop-contract-catalog'
import ApiTab from './ApiTab.vue'

const routerId = 'bfl/flux-2-pro'
const contract = workshopContract(routerId)
const values = { prompt: 'a capybara', seed: 5 }

function pythonKey(text: string): string {
  const key = /"Idempotency-Key": "([^"]+)"/.exec(text)?.[1]
  if (!key) throw new Error('Missing key')
  return key
}

describe('ApiTab', () => {
  it('generates URL-upload examples without uploading or reading private files while browsing tabs', async () => {
    const user = userEvent.setup()
    const file = new File(['private'], 'photo.png', { type: 'image/png' })
    const network = vi.fn()
    const read = vi.spyOn(file, 'arrayBuffer')
    vi.stubGlobal('fetch', network)
    render(ApiTab, {
      props: {
        contract: workshopContract('wavespeed/seedvr2'),
        values: {
          image: { file, name: file.name, type: file.type, size: file.size }
        }
      }
    })
    const snippet = await screen.findByTestId('snippet')
    expect(snippet.textContent).toContain(
      'upload_file("photo.png", "image/png")'
    )
    expect(snippet.textContent).toContain('/customers/storage')
    expect(snippet.textContent).toContain('"image": input_1')
    expect(snippet.textContent).not.toContain('https://upload.invalid/')
    await user.click(screen.getByTestId('snippet-typescript'))
    expect(snippet.textContent).toContain(
      'await uploadFile("photo.png", "image/png")'
    )
    await user.click(screen.getByTestId('snippet-curl'))
    expect(snippet.textContent).not.toContain('"image":')
    expect(snippet.textContent).not.toContain('/customers/storage')
    expect(snippet.textContent).toContain('This request may be incomplete')
    expect(network).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })
  it('uses one validated request and retry key across language tabs', async () => {
    const user = userEvent.setup()
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    render(ApiTab, { props: { contract, values } })
    const snippet = await screen.findByTestId('snippet')
    const key = pythonKey(snippet.textContent)
    expect(snippet.textContent).toBe(
      buildSnippet('python', routerId, values, key)
    )
    await user.click(screen.getByTestId('snippet-typescript'))
    expect(snippet.textContent).toBe(
      buildSnippet('typescript', routerId, values, key)
    )
    await user.click(screen.getByTestId('snippet-curl'))
    expect(snippet.textContent).toBe(
      buildSnippet('curl', routerId, values, key)
    )
    expect(network).not.toHaveBeenCalled()
  })

  it('rotates the key for an edited body but not a semantically unchanged body', async () => {
    const { rerender } = render(ApiTab, { props: { contract, values } })
    const first = pythonKey((await screen.findByTestId('snippet')).textContent)
    await rerender({ values: { ...values, unused: undefined } })
    await waitFor(() =>
      expect(pythonKey(screen.getByTestId('snippet').textContent)).toBe(first)
    )
    await rerender({ values: { ...values, prompt: 'a different capybara' } })
    await waitFor(() =>
      expect(pythonKey(screen.getByTestId('snippet').textContent)).not.toBe(
        first
      )
    )
  })

  it('does not publish a request for invalid input or an unverified model mapping', async () => {
    const { rerender } = render(ApiTab, {
      props: { contract, values: { prompt: '', width: 0 } }
    })
    expect(screen.queryByTestId('snippet')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain(
      'Complete valid model inputs'
    )
    await rerender({ contract: undefined, values })
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'has not been verified'
      )
    )
    expect(screen.queryByRole('button', { name: 'Copy snippet' })).toBeNull()
  })

  it('loads local files in Python and TypeScript but omits them from cURL without reading upload bytes', async () => {
    const user = userEvent.setup()
    const file = new File(['real image'], 'image.png', { type: 'image/png' })
    const read = vi.spyOn(file, 'arrayBuffer')
    render(ApiTab, {
      props: {
        contract,
        values: {
          ...values,
          media_image: {
            file,
            name: file.name,
            size: file.size,
            type: file.type
          }
        }
      }
    })
    const snippet = await screen.findByTestId('snippet')
    const key = pythonKey(snippet.textContent)
    expect(snippet.textContent).not.toContain(btoa('real image'))
    expect(snippet.textContent).toContain('Path("image.png").read_bytes()')
    expect(snippet.textContent).toContain('base64.b64encode')
    expect(snippet.textContent).toContain('input_image')
    expect(snippet.textContent).not.toContain('media_image')
    expect(screen.getByRole('note').textContent).toContain('local files')
    await user.click(screen.getByTestId('snippet-typescript'))
    expect(snippet.textContent).toContain('readFile("image.png")')
    expect(snippet.textContent).toContain('.toString("base64")')
    expect(snippet.textContent).toContain(key)
    await user.click(screen.getByTestId('snippet-curl'))
    expect(snippet.textContent).not.toContain('input_image')
    expect(snippet.textContent).not.toContain('image.png')
    expect(snippet.textContent).toContain('"prompt": "a capybara"')
    expect(snippet.textContent).toContain('This request may be incomplete')
    expect(snippet.textContent).not.toContain(key)
    expect(screen.getByRole('note').textContent).toContain('omitted from cURL')
    const curl = snippet.textContent
    await user.click(screen.getByTestId('snippet-python'))
    expect(pythonKey(snippet.textContent)).toBe(key)
    await user.click(screen.getByTestId('snippet-curl'))
    expect(snippet.textContent).toBe(curl)
    expect(read).not.toHaveBeenCalled()
  })

  it('keeps file references stable and rotates the key for a replacement file with identical metadata', async () => {
    const first = new File(['first'], 'image.png', {
      type: 'image/png',
      lastModified: 123
    })
    const second = new File(['other'], first.name, {
      type: first.type,
      lastModified: first.lastModified
    })
    function form(file: File) {
      return {
        ...values,
        media_image: { file, name: file.name, size: file.size, type: file.type }
      }
    }
    const { rerender } = render(ApiTab, {
      props: { contract, values: form(first) }
    })
    const key = pythonKey((await screen.findByTestId('snippet')).textContent)
    await rerender({ values: form(first) })
    expect(pythonKey((await screen.findByTestId('snippet')).textContent)).toBe(
      key
    )
    await rerender({ values: form(second) })
    expect(
      pythonKey((await screen.findByTestId('snippet')).textContent)
    ).not.toBe(key)
  })
})

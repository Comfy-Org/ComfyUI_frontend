import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { buildSnippet } from '../../config/models-snippets'
import { workshopContract } from '../../config/workshop-contract-catalog'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import ApiTab from './ApiTab.vue'

const routerId = 'bfl/flux-2-pro'
const contract = workshopContract(routerId)
const values = { prompt: 'a capybara', seed: 5 }

describe('ApiTab', () => {
  it('reuses one file setup for repeated positions in a multi-file input', async () => {
    const visitor = userEvent.setup()
    const model = getRouterWorkshopModelDetail(
      'byteplus--seedream-4-5--edit-images'
    )
    if (!model) throw new Error('Missing model')
    const file = new File(['private'], 'reference.webp', { type: 'image/webp' })
    const value = { file, name: file.name, type: file.type, size: file.size }
    render(ApiTab, {
      props: {
        contract: model.execution,
        values: {
          ...initialWorkshopPageState(model).values,
          images: [value, value]
        }
      }
    })
    const snippet = await screen.findByTestId('snippet')
    expect(
      snippet.textContent.match(/from_file\("reference.webp"\)/g)
    ).toHaveLength(1)
    expect(snippet.textContent).toMatch(/"image":\s*\[\s*url_1,\s*url_1\s*\]/)
    await visitor.click(screen.getByTestId('snippet-typescript'))
    expect(
      snippet.textContent.match(/fromFile\("reference.webp"\)/g)
    ).toHaveLength(1)
    expect(snippet.textContent).toMatch(/"image":\s*\[\s*url_1,\s*url_1\s*\]/)
  })

  it('prepares SDK asset examples without uploading or reading private files while browsing tabs', async () => {
    const visitor = userEvent.setup()
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
      'client.assets.from_file("photo.png").get_download_url()'
    )
    expect(snippet.textContent).toContain('"image": url_1')
    expect(snippet.textContent).not.toContain('https://upload.invalid/')
    await visitor.click(screen.getByTestId('snippet-typescript'))
    expect(snippet.textContent).toContain(
      'client.assets.fromFile("photo.png").getDownloadUrl()'
    )
    await visitor.click(screen.getByTestId('snippet-curl'))
    expect(snippet.textContent).not.toContain('"image":')
    expect(snippet.textContent).toContain('This request may be incomplete')
    expect(network).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it('uses the validated native parameters across language tabs and updates when the form changes', async () => {
    const visitor = userEvent.setup()
    const { rerender } = render(ApiTab, { props: { contract, values } })
    const snippet = await screen.findByTestId('snippet')
    expect(snippet.textContent).toBe(buildSnippet('python', routerId, values))
    await visitor.click(screen.getByTestId('snippet-typescript'))
    expect(snippet.textContent).toBe(
      buildSnippet('typescript', routerId, values)
    )
    await rerender({ values: { ...values, prompt: 'a different capybara' } })
    await waitFor(() =>
      expect(screen.getByTestId('snippet').textContent).toContain(
        'a different capybara'
      )
    )
    await visitor.click(screen.getByTestId('snippet-curl'))
    expect(screen.getByTestId('snippet').textContent).toContain(
      'a different capybara'
    )
  })

  it('does not publish invalid input or an unverified model mapping', async () => {
    const { rerender } = render(ApiTab, {
      props: { contract, values: { prompt: '', width: 0 } }
    })
    expect(screen.queryByTestId('snippet')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain(
      'Fill in the Playground inputs'
    )
    await rerender({ contract: undefined, values })
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        'We have not verified'
      )
    )
    expect(screen.queryByRole('button', { name: 'Copy snippet' })).toBeNull()
  })

  it('uses local file examples for Base64 inputs without exposing embedded bytes', async () => {
    const visitor = userEvent.setup()
    const encoded = btoa('private pixels')
    const sourceDataUrl = `data:image/png;base64,${encoded}`
    const file = new File(['private pixels'], 'image.png', {
      type: 'image/png'
    })
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
            type: file.type,
            sourceDataUrl
          }
        }
      }
    })
    const snippet = await screen.findByTestId('snippet')
    expect(snippet.textContent).toContain('Path("image.png").read_bytes()')
    expect(snippet.textContent).toContain('input_image')
    expect(snippet.textContent).not.toContain(encoded)
    expect(snippet.textContent).not.toContain(sourceDataUrl)
    await visitor.click(screen.getByRole('button', { name: 'Copy snippet' }))
    const copied = await navigator.clipboard.readText()
    expect(copied).toBe(snippet.textContent)
    expect(copied).not.toContain(encoded)
    expect(copied).not.toContain(sourceDataUrl)
    await visitor.click(screen.getByTestId('snippet-typescript'))
    expect(snippet.textContent).toContain('readFile("image.png")')
    expect(snippet.textContent).toContain('.toString("base64")')
    expect(snippet.textContent).not.toContain(encoded)
    await visitor.click(screen.getByTestId('snippet-curl'))
    expect(snippet.textContent).not.toContain(encoded)
    expect(read).not.toHaveBeenCalled()
  })

  it.for([
    {
      slug: 'vertexai--gemini-3-pro-image--edit-images',
      source: 'gemini-3-pro-image-input-1.1.png'
    },
    {
      slug: 'bfl--flux-2-max--generate-images',
      source: 'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@'
    }
  ])(
    'uses default source URLs without fetching media to show the API example: $slug',
    async ({ slug, source }) => {
      const model = getRouterWorkshopModelDetail(slug)
      if (!model) throw new Error('Missing model')
      const network = vi.fn(() =>
        Promise.reject(new Error('API browsing must not fetch media'))
      )
      vi.stubGlobal('fetch', network)
      render(ApiTab, {
        props: {
          contract: model.execution,
          values: initialWorkshopPageState(model).values
        }
      })
      const snippet = await screen.findByTestId('snippet')
      expect(snippet.textContent).toContain(source)
      expect(snippet.textContent).not.toContain('Path(')
      expect(network).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      modelSlug: 'bfl--flux-2-pro',
      href: 'https://platform.comfy.org/profile/api-keys?onboarding=models&model=bfl--flux-2-pro'
    },
    {
      modelSlug: undefined,
      href: 'https://platform.comfy.org/profile/api-keys?onboarding=models'
    }
  ])(
    'sends the get-key link as a models onboarding arrival, naming the model page when given one: $modelSlug',
    async ({ modelSlug, href }) => {
      render(ApiTab, { props: { contract, values, modelSlug } })
      expect(
        (await screen.findByTestId('api-get-key')).getAttribute('href')
      ).toBe(href)
    }
  )
})

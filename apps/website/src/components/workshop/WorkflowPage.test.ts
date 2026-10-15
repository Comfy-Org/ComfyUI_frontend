import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import WorkflowPage from './WorkflowPage.vue'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/scripts/posthog'))

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')

// The run itself is WorkflowPlayground's to test; here only whether the page
// offers it matters.
const playgroundStub = { template: '<div data-testid="workflow-playground" />' }

const mount = (selected = model) =>
  render(WorkflowPage, {
    props: { model: selected },
    global: { stubs: { WorkflowPlayground: playgroundStub } }
  })

describe('WorkflowPage header', () => {
  it('does not switch the legacy consumer layout before catalog activation', () => {
    mount({
      ...model,
      workflow: { ...model.workflow, inputs: {} }
    })
    expect(screen.getByTestId('workflow-playground')).toBeTruthy()
  })
  it.for([false, true, undefined])(
    'keeps a workflow with no inputs download-only (runnable=%s)',
    (runnable) => {
      const emptyWorkflow = {
        ...model.workflow,
        inputs: {},
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
          additionalProperties: false as const
        },
        cloud: undefined
      }
      render(WorkflowPage, {
        props: {
          model: {
            ...model,
            workflow: emptyWorkflow,
            form: {
              parameters: emptyWorkflow.inputSchema,
              inputs: {},
              roles: [],
              advancedFields: []
            },
            catalogDetails: {
              locale: 'en',
              faqs: [],
              models: [],
              runnable,
              scriptCode: { python: 'print("Download-only example")' }
            }
          }
        },
        global: {
          stubs: {
            WorkflowPlayground: playgroundStub,
            WorkflowGraph: true,
            HighlightedCode: {
              props: ['code'],
              template: '<code>{{code}}</code>'
            }
          }
        }
      })
      expect(screen.queryByTestId('workflow-playground')).toBeNull()
      expect(screen.queryByRole('tab', { name: 'Playground' })).toBeNull()
      expect(
        screen.getByRole('link', { name: 'Download workflow JSON' })
      ).toHaveAttribute('href', template.downloadUrl)
      expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
        'Download-only example'
      )
      expect(screen.queryByTestId('workflow-api-endpoint')).toBeNull()
    }
  )
  it('turns off the run layout without disabling generated code for a workflow with inputs', () => {
    render(WorkflowPage, {
      props: {
        model: {
          ...model,
          catalogDetails: {
            locale: 'en',
            faqs: [],
            models: [],
            runnable: false
          }
        }
      },
      global: {
        stubs: {
          WorkflowPlayground: true,
          WorkflowGraph: true,
          HighlightedCode: {
            props: ['code'],
            template: '<code>{{code}}</code>'
          }
        }
      }
    })
    expect(screen.queryByTestId('workflow-playground')).toBeNull()
    expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
      'from comfy_sdk import Comfy'
    )
    expect(screen.getByRole('tab', { name: 'cURL' })).toBeVisible()
  })
  it('offers an actual Cloud share link without inventing a share ID from the catalog UID', () => {
    mount({
      ...model,
      catalogDetails: {
        locale: 'en',
        faqs: [],
        models: [],
        cloudShareURL: 'https://cloud.comfy.org/?share=abcdef123456'
      }
    })
    expect(screen.getByRole('link', { name: 'Try in Cloud' })).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?share=abcdef123456'
    )
  })
  it('offers no Try in Cloud for a catalog workflow that does not work on Cloud', () => {
    mount({
      ...model,
      catalogDetails: {
        locale: 'en',
        faqs: [],
        models: [],
        worksOnCloud: false,
        cloudShareURL: 'https://cloud.comfy.org/?share=abcdef123456'
      }
    })
    expect(screen.queryByRole('link', { name: 'Try in Cloud' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Download workflow JSON' })
    ).toBeVisible()
  })
  it('downloads the catalog graph JSON up top, beside its API documentation', () => {
    const uid = '00000000-0000-4000-8000-000000000080'
    const graph = `/preview-media/7/${uid}/00000000-0000-4000-8000-000000000081`
    mount({
      ...model,
      catalogDetails: {
        locale: 'en',
        faqs: [],
        models: [],
        documentationURL: 'https://docs.comfy.org/api-reference/',
        workflowFiles: [{ name: 'V1', uid, href: graph }],
        apiWorkflowFile: {
          name: 'V1',
          uid,
          version: '00000000-0000-4000-8000-000000000082',
          href: `/preview-media/7/${uid}/00000000-0000-4000-8000-000000000082`
        }
      }
    })
    const actions = screen.getByTestId('workflow-actions')
    const download = within(actions).getByRole('link', {
      name: 'Download workflow JSON'
    })
    expect(download).toHaveAttribute('href', graph)
    expect(download).toHaveAttribute('download', 'remove-background.json')
    expect(
      within(actions).getByRole('link', { name: 'API documentation' })
    ).toHaveAttribute('href', 'https://docs.comfy.org/api-reference/')
  })
  it('does not fall back to the legacy template download when declared catalog files are unavailable', () => {
    mount({
      ...model,
      catalogDetails: { locale: 'en', faqs: [], models: [], workflowFiles: [] }
    })
    expect(
      screen.queryByRole('link', { name: 'Download workflow JSON' })
    ).toBeNull()
  })
  it('renders multi-paragraph body and expandable Q&A using authored copy, not HTML', async () => {
    mount({
      ...model,
      catalogDetails: {
        locale: 'en',
        models: [],
        longDescription: 'First paragraph.\n\nSecond paragraph.',
        faqs: [
          {
            id: 'first',
            question: 'Can I customize it?',
            answer: 'Yes, edit the downloaded JSON.'
          }
        ]
      }
    })
    expect(
      screen.getByRole('heading', { name: 'About this workflow' })
    ).toBeVisible()
    expect(screen.getByText('First paragraph.')).toBeVisible()
    expect(screen.getByText('Second paragraph.')).toBeVisible()
    const question = screen.getByRole('button', { name: 'Can I customize it?' })
    question.click()
    await waitFor(() =>
      expect(screen.getByText('Yes, edit the downloaded JSON.')).toBeVisible()
    )
  })

  it('does not show empty body or Q&A sections', () => {
    mount({
      ...model,
      catalogDetails: {
        locale: 'en',
        models: [],
        longDescription: ' \n ',
        faqs: [{ id: 'empty', question: ' ', answer: '' }]
      }
    })
    expect(
      screen.queryByRole('heading', { name: 'About this workflow' })
    ).toBeNull()
    expect(
      screen.queryByRole('heading', { name: 'Questions & answers' })
    ).toBeNull()
  })
  it('sends the shelf it names to that shelf, filtered', () => {
    mount()

    const shelf = screen.getByTestId('workflow-use-case')
    expect(shelf.textContent.trim()).toBe('Edit images')
    expect(shelf.getAttribute('href')).toBe('/hub/workflows/?category=cleanup')
  })

  it('leads back to the workflows page', () => {
    mount()

    expect(
      screen.getByRole('link', { name: 'Back to workflows' })
    ).toHaveAttribute('href', '/hub/workflows/')
  })

  it('says nothing about a shelf a workflow has none of', () => {
    mount({
      ...model,
      useCases: [],
      task: undefined,
      modality: undefined
    })

    expect(screen.queryByTestId('workflow-use-case')).toBeNull()
  })

  it('leaves the credit and the models to the Details tab', () => {
    mount()

    const hero = screen.getByTestId('workflow-hero')
    expect(hero).toHaveTextContent(model.name)
    expect(hero).not.toHaveTextContent(`Template by ${template.author}`)
    for (const name of template.models) expect(hero).not.toHaveTextContent(name)
  })

  it('offers the download and Try in Cloud up top, leaving the run to the form', () => {
    mount()

    const actions = within(screen.getByTestId('workflow-hero')).getByTestId(
      'workflow-actions'
    )
    const cloudHref = `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(template.id)}`
    expect(
      within(actions)
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([
      ['Download', template.downloadUrl],
      ['Try in Cloud', cloudHref]
    ])
    expect(
      within(actions).getByRole('link', { name: 'Download workflow JSON' })
    ).toHaveAttribute('download')
    const cloud = within(actions).getByRole('link', { name: 'Try in Cloud' })
    expect(cloud).toHaveAttribute('target', '_blank')
    expect(cloud).toHaveAttribute('rel', 'noopener')
    expect(within(actions).queryByRole('button')).toBeNull()
    expect(within(actions).queryByText(/run|sign in/i)).toBeNull()
  })

  it('offers no actions for a workflow with no template', () => {
    mount({
      ...model,
      workflow: { ...model.workflow, template: undefined }
    })

    expect(screen.queryByTestId('workflow-actions')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Try in Cloud' })).toBeNull()
  })

  it('reports Try in Cloud once access is enabled', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    mount()
    const link = screen.getByRole('link', { name: 'Try in Cloud' })
    link.addEventListener('click', (click) => click.preventDefault(), {
      once: true
    })

    await userEvent.setup().click(link)

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'try_in_cloud_clicked',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        workflow_id: model.workflowId
      })
    })
  })

  it('reports the download once access is enabled', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    mount()
    const link = screen.getByRole('link', { name: 'Download workflow JSON' })
    link.addEventListener('click', (click) => click.preventDefault(), {
      once: true
    })

    await userEvent.setup().click(link)

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'workflow_download_clicked',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        workflow_id: model.workflowId
      })
    })
  })

  it('reports no download while Workflows access is off', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(false)))
    mount()
    const link = screen.getByRole('link', { name: 'Download workflow JSON' })
    link.addEventListener('click', (click) => click.preventDefault(), {
      once: true
    })
    await userEvent.setup().click(link)

    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })
})

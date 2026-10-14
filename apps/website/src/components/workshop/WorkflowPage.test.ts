import { render, screen, waitFor } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'

import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import WorkflowPage from './WorkflowPage.vue'

vi.mock(import('@/config/workshop-session-state'))

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')

const mount = (selected = model) =>
  render(WorkflowPage, {
    props: { model: selected },
    global: { stubs: { WorkflowPlayground: true } }
  })

describe('WorkflowPage header', () => {
  it('does not switch the legacy consumer layout before catalog activation', () => {
    const { container } = mount({
      ...model,
      workflow: { ...model.workflow, inputs: {} }
    })
    expect(container.querySelector('workflow-playground-stub')).not.toBeNull()
  })
  it.each([false, true, undefined])(
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
      const { container } = render(WorkflowPage, {
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
            WorkflowPlayground: true,
            WorkflowGraph: true,
            HighlightedCode: {
              props: ['code'],
              template: '<code>{{code}}</code>'
            }
          }
        }
      })
      expect(container.querySelector('workflow-playground-stub')).toBeNull()
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
    const { container } = render(WorkflowPage, {
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
    expect(container.querySelector('workflow-playground-stub')).toBeNull()
    expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
      'from comfy_sdk import Comfy'
    )
    expect(screen.getByRole('tab', { name: 'cURL' })).toBeVisible()
  })
  it('passes an actual Cloud share link without inventing a share ID from the catalog UID', () => {
    const { getByTestId } = render(WorkflowPage, {
      props: {
        model: {
          ...model,
          catalogDetails: {
            locale: 'en',
            faqs: [],
            models: [],
            cloudShareURL: 'https://cloud.comfy.org/?share=abcdef123456'
          }
        }
      },
      global: {
        stubs: {
          WorkflowPlayground: {
            props: ['cloudHref'],
            template:
              '<a data-testid="share-fixture" :href="cloudHref">Open</a>'
          }
        }
      }
    })
    expect(getByTestId('share-fixture')).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?share=abcdef123456'
    )
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
})

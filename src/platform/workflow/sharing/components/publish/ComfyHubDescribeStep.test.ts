/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'

const mockFetchTagLabels = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workflow/sharing/services/comfyHubService', () => ({
  useComfyHubService: () => ({
    fetchTagLabels: mockFetchTagLabels
  })
}))

import ComfyHubDescribeStep from './ComfyHubDescribeStep.vue'

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

function renderStep(
  props: Partial<InstanceType<typeof ComfyHubDescribeStep>['$props']> = {},
  callbacks: Record<string, ReturnType<typeof vi.fn>> = {}
) {
  return render(ComfyHubDescribeStep, {
    props: {
      name: 'Workflow Name',
      description: 'Workflow description',
      tags: [],
      ...props,
      ...callbacks
    },
    global: {
      mocks: {
        $t: (key: string) => key
      },
      stubs: {
        Input: {
          template:
            '<input data-testid="name-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue']
        },
        Textarea: {
          template:
            '<textarea data-testid="description-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue']
        },
        TagsInput: {
          template:
            '<div data-testid="tags-input" :data-disabled="disabled ? \'true\' : \'false\'"><slot :is-empty="!modelValue || modelValue.length === 0" /></div>',
          props: {
            modelValue: {
              type: Array,
              default: () => []
            },
            disabled: Boolean
          }
        },
        TagsInputItem: {
          template:
            '<button data-testid="tag-item" :data-value="value" type="button"><slot /></button>',
          props: ['value']
        },
        TagsInputItemText: {
          template: '<span data-testid="tag-item-text" />'
        },
        TagsInputItemDelete: {
          template: '<button data-testid="tag-item-delete" type="button" />'
        },
        TagsInputInput: {
          template: '<input data-testid="tags-input-input" />'
        },
        Button: {
          template:
            '<button data-testid="toggle-suggestions" type="button"><slot /></button>'
        }
      }
    }
  })
}

describe('ComfyHubDescribeStep', () => {
  it('emits name and description updates', async () => {
    mockFetchTagLabels.mockRejectedValue(new Error('offline'))
    const onUpdateName = vi.fn()
    const onUpdateDescription = vi.fn()
    renderStep(
      {},
      {
        'onUpdate:name': onUpdateName,
        'onUpdate:description': onUpdateDescription
      }
    )
    await flushPromises()

    const nameInput = screen.getByTestId('name-input')
    const descInput = screen.getByTestId('description-input')

    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'New workflow')
    await userEvent.clear(descInput)
    await userEvent.type(descInput, 'New description')

    expect(onUpdateName).toHaveBeenLastCalledWith('New workflow')
    expect(onUpdateDescription).toHaveBeenLastCalledWith('New description')
  })

  it('uses fetched tags from API', async () => {
    const apiTags = ['Alpha', 'Beta', 'Gamma']
    mockFetchTagLabels.mockResolvedValue(apiTags)
    const { container } = renderStep()
    await flushPromises()

    const suggestionValues = Array.from(
      container.querySelectorAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
    ).map((el) => el.getAttribute('data-value'))

    expect(suggestionValues).toEqual(apiTags)
  })

  it('falls back to hardcoded tags when API fails', async () => {
    mockFetchTagLabels.mockRejectedValue(new Error('network error'))
    const { container } = renderStep()
    await flushPromises()

    const suggestionValues = Array.from(
      container.querySelectorAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
    ).map((el) => el.getAttribute('data-value'))

    expect(suggestionValues).toHaveLength(10)
    expect(suggestionValues[0]).toBe(COMFY_HUB_TAG_OPTIONS[0])
  })

  it('adds a suggested tag when clicked', async () => {
    const apiTags = ['Alpha', 'Beta']
    mockFetchTagLabels.mockResolvedValue(apiTags)
    const onUpdateTags = vi.fn()
    const { container } = renderStep({}, { 'onUpdate:tags': onUpdateTags })
    await flushPromises()

    const suggestionButtons = container.querySelectorAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )

    await userEvent.click(suggestionButtons[0] as HTMLElement)

    expect(onUpdateTags).toHaveBeenLastCalledWith(['Alpha'])
  })

  it('hides already-selected tags from suggestions', async () => {
    const apiTags = ['Alpha', 'Beta', 'Gamma']
    mockFetchTagLabels.mockResolvedValue(apiTags)
    const { container } = renderStep({ tags: ['Alpha'] })
    await flushPromises()

    const suggestionValues = Array.from(
      container.querySelectorAll(
        '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
      )
    ).map((el) => el.getAttribute('data-value'))

    expect(suggestionValues).not.toContain('Alpha')
    expect(suggestionValues).toEqual(['Beta', 'Gamma'])
  })

  it('toggles between default and full suggestion lists', async () => {
    mockFetchTagLabels.mockRejectedValue(new Error('offline'))
    const { container } = renderStep()
    await flushPromises()

    const defaultSuggestions = container.querySelectorAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )
    expect(defaultSuggestions).toHaveLength(10)
    expect(container.textContent).toContain('comfyHubPublish.showMoreTags')

    await userEvent.click(screen.getByTestId('toggle-suggestions'))
    await nextTick()

    const allSuggestions = container.querySelectorAll(
      '[data-testid="tags-input"][data-disabled="true"] [data-testid="tag-item"]'
    )
    expect(allSuggestions).toHaveLength(COMFY_HUB_TAG_OPTIONS.length)
    expect(container.textContent).toContain('comfyHubPublish.showLessTags')
  })
})

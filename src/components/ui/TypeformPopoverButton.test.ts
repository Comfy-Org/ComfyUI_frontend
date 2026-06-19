import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueUse from '@vueuse/core'
import { computed, defineComponent, h } from 'vue'

import TypeformPopoverButton from './TypeformPopoverButton.vue'

const isMobile = vi.hoisted(() => ({ value: false }))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    useBreakpoints: () => ({ smaller: () => computed(() => isMobile.value) })
  }
})

vi.mock('@/platform/surveys/surveyIdentity', () => ({
  getSurveyIdentityTags: () => ({ anon_id: 'anon-1' }),
  getSurveyIdentityTagsAsync: () => Promise.resolve({ anon_id: 'anon-1' })
}))

const PopoverStub = defineComponent({
  name: 'Popover',
  setup(_, { slots }) {
    return () => h('div', [slots.button?.(), slots.default?.()])
  }
})

const TypeformEmbedStub = defineComponent({
  name: 'TypeformEmbed',
  props: { typeformId: { type: String, required: true } },
  setup(props) {
    return () =>
      h('div', { 'data-testid': 'embed', 'data-typeform-id': props.typeformId })
  }
})

function renderButton(props: { dataTfWidget: string; active?: boolean }) {
  return render(TypeformPopoverButton, {
    props,
    global: {
      stubs: { Popover: PopoverStub, TypeformEmbed: TypeformEmbedStub }
    }
  })
}

describe('TypeformPopoverButton', () => {
  beforeEach(() => {
    isMobile.value = false
  })

  it('embeds the active survey in a popover on desktop', () => {
    renderButton({ dataTfWidget: 'abc123' })

    expect(screen.getByTestId('embed')).toHaveAttribute(
      'data-typeform-id',
      'abc123'
    )
  })

  it('omits the embed when inactive', () => {
    renderButton({ dataTfWidget: 'abc123', active: false })

    expect(screen.queryByTestId('embed')).not.toBeInTheDocument()
  })

  it('links directly to the form on mobile instead of embedding', () => {
    isMobile.value = true
    renderButton({ dataTfWidget: 'abc123' })

    expect(screen.queryByTestId('embed')).not.toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://form.typeform.com/to/abc123#anon_id=anon-1'
    )
  })
})

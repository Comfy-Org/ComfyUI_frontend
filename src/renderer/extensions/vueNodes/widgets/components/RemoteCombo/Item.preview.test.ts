import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ComboboxRoot } from 'reka-ui'
import { computed, defineComponent, h, provide, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { DropdownItemShape } from '@/base/remote/itemSchema'

import Item from './Item.vue'
import { RemoteComboKey } from './state'
import type { RemoteComboContext, RemoteComboPreviewType } from './state'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      widgets: {
        remoteCombo: {
          playAudioPreview: 'Play audio preview for {item}',
          pauseAudioPreview: 'Pause audio preview for {item}'
        }
      }
    }
  }
})

function makeCtx(previewType: RemoteComboPreviewType): RemoteComboContext {
  return {
    isOpen: ref(true),
    searchQuery: ref(''),
    selectedValue: ref<string | undefined>(undefined),
    items: computed(() => []),
    filteredItems: computed(() => []),
    isLoading: computed(() => false),
    isFetching: computed(() => false),
    errorMessage: computed(() => null),
    refresh: async () => {},
    select: () => {},
    fieldLabel: computed(() => 'field'),
    previewType: computed(() => previewType)
  }
}

function renderItemInOpenCombobox(
  item: DropdownItemShape,
  previewType: RemoteComboPreviewType
) {
  const Host = defineComponent({
    setup() {
      provide(RemoteComboKey, makeCtx(previewType))
      return () =>
        h(
          ComboboxRoot,
          { open: true, modelValue: undefined },
          {
            default: () => h(Item, { item, index: 0 })
          }
        )
    }
  })
  return render(Host, { global: { plugins: [i18n] } })
}

describe('RemoteCombo.Item preview rendering', () => {
  it('renders an <img> for image preview_type with preview_url', () => {
    renderItemInOpenCombobox(
      {
        id: '1',
        name: 'Picture',
        preview_url: 'https://cdn.example.com/p.png'
      },
      'image'
    )
    const img = screen.getByRole('img', { name: /picture/i })
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/p.png')
  })

  it('plays an audio preview from its control', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    renderItemInOpenCombobox(
      { id: '1', name: 'Voice', preview_url: 'https://cdn.example.com/a.mp3' },
      'audio'
    )
    const button = screen.getByRole('button', {
      name: 'Play audio preview for Voice'
    })

    await userEvent.click(button)

    expect(play).toHaveBeenCalledOnce()
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
  })

  it('omits preview element when preview_url is missing', () => {
    renderItemInOpenCombobox({ id: '1', name: 'NoPreview' }, 'image')
    expect(screen.queryByRole('img')).toBeNull()
  })
})

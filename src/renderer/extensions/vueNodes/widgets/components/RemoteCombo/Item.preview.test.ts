import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
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
          playAudioPreview: 'Play audio preview',
          pauseAudioPreview: 'Pause audio preview'
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

  it('renders an audio play button for audio preview_type with preview_url', () => {
    renderItemInOpenCombobox(
      { id: '1', name: 'Voice', preview_url: 'https://cdn.example.com/a.mp3' },
      'audio'
    )
    expect(
      screen.getByRole('button', { name: /play audio preview/i })
    ).toBeInTheDocument()
  })

  it('omits preview element when preview_url is missing', () => {
    renderItemInOpenCombobox({ id: '1', name: 'NoPreview' }, 'image')
    expect(screen.queryByRole('img')).toBeNull()
  })
})

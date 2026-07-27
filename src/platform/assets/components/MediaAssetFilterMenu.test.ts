import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import MediaAssetFilterButton from '@/platform/assets/components/MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from '@/platform/assets/components/MediaAssetFilterMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderMenu(mediaTypeFilters: string[] = []) {
  const onUpdate = vi.fn()
  const TestHost = defineComponent({
    components: { MediaAssetFilterButton, MediaAssetFilterMenu },
    setup: () => ({ mediaTypeFilters, onUpdate }),
    template: `
      <MediaAssetFilterButton>
        <MediaAssetFilterMenu
          :media-type-filters="mediaTypeFilters"
          @update:media-type-filters="onUpdate"
        />
      </MediaAssetFilterButton>
    `
  })

  const utils = render(TestHost, {
    global: { plugins: [i18n] }
  })
  return { ...utils, onUpdate, user: userEvent.setup() }
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Filter by' }))
}

async function openMediaTypeMenu(user: ReturnType<typeof userEvent.setup>) {
  await openMenu(user)
  await user.click(screen.getByRole('menuitem', { name: /Media type/ }))
}

const mediaTypeLabels = ['Image', 'Video', 'Audio', '3D', 'Text']

describe('MediaAssetFilterMenu', () => {
  it('groups media types under the Attribute section', async () => {
    const { user } = renderMenu()
    await openMenu(user)

    expect(screen.getByText('Attribute')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /Media type/ })).toBeVisible()
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Image' })).toBeNull()
  })

  it('shows every media type in the nested menu', async () => {
    const { user } = renderMenu()
    await openMediaTypeMenu(user)

    for (const label of mediaTypeLabels) {
      expect(
        screen.getByRole('menuitemcheckbox', { name: label })
      ).toBeVisible()
    }
  })

  it('reflects the selected media types', async () => {
    const { user } = renderMenu(['image', '3d'])
    await openMediaTypeMenu(user)

    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Image' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemcheckbox', { name: '3D' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Video' })
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('adds a media type without closing either menu', async () => {
    const { onUpdate, user } = renderMenu(['image'])
    await openMediaTypeMenu(user)

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Video' }))

    expect(onUpdate).toHaveBeenCalledWith(['image', 'video'])
    expect(screen.getByRole('menu', { name: 'Filter by' })).toBeVisible()
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Video' })
    ).toBeVisible()
  })

  it('removes an already selected media type', async () => {
    const { onUpdate, user } = renderMenu(['image', 'audio'])
    await openMediaTypeMenu(user)

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Audio' }))

    expect(onUpdate).toHaveBeenCalledWith(['image'])
  })
})

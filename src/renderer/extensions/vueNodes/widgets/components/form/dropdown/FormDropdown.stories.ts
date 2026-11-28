import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import { computed, provide, ref, watch } from 'vue'

import { assetThumbnail } from '@/platform/assets/utils/assetThumbnailUtil'
import type { AssetKind } from '@/types/widgetTypes'

import FormDropdown from './FormDropdown.vue'
import { AssetKindKey } from './types'
import type { FormDropdownItem } from './types'

const images: FormDropdownItem[] = Array.from({ length: 24 }, (_, index) => {
  const name = `fennec-daisies-${String(index + 1).padStart(2, '0')}.png`
  return {
    id: name,
    name,
    thumbnail: assetThumbnail({
      name,
      preview_url: '/assets/images/fennec-daisies.png'
    })
  }
})

const videos: FormDropdownItem[] = [
  {
    id: 'wide',
    name: 'wide.webm',
    thumbnail: assetThumbnail({
      name: 'wide.webm',
      preview_url: new URL(
        '../../../../../../../../browser_tests/assets/video/video-preview-wide.webm',
        import.meta.url
      ).href
    })
  },
  {
    id: 'portrait',
    name: 'portrait.webm',
    thumbnail: assetThumbnail({
      name: 'portrait.webm',
      preview_url: new URL(
        '../../../../../../../../browser_tests/assets/video/video-preview-portrait.webm',
        import.meta.url
      ).href
    })
  }
]

const meta: Meta<{
  kind: Extract<AssetKind, 'image' | 'video'>
  uploadable: boolean
  disabled: boolean
  multiple: boolean | number
}> = {
  title: 'Widgets/FormDropdown',
  component: FormDropdown,
  tags: ['autodocs'],
  args: { kind: 'image', uploadable: true, disabled: false, multiple: false },
  argTypes: { kind: { control: 'radio', options: ['image', 'video'] } },
  render: (args) => ({
    components: { FormDropdown },
    setup() {
      const items = computed(() => (args.kind === 'image' ? images : videos))
      const selected = ref(new Set<string>())
      watch(items, (next) => (selected.value = new Set([next[0].id])), {
        immediate: true
      })
      provide(
        AssetKindKey,
        computed(() => args.kind)
      )
      return { args, items, selected }
    },
    template: `
      <div class="mx-auto w-full max-w-103 rounded-lg bg-node p-4">
        <FormDropdown
          v-model:selected="selected"
          :items="items"
          :placeholder="args.kind === 'image' ? 'Select image...' : 'Select video...'"
          :accept="args.kind === 'image' ? 'image/*,.exr' : 'video/*'"
          :uploadable="args.uploadable"
          :disabled="args.disabled"
          :multiple="args.multiple"
        />
      </div>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const BrowseMedia: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const name = args.kind === 'image' ? 'fennec-daisies-01.png' : 'wide.webm'
    await userEvent.click(canvas.getByRole('button', { name }))
    const picker = within(canvasElement.ownerDocument.body).getByRole('dialog')
    await expect(picker).toBeVisible()
    await expect(within(picker).getByText(name)).toBeVisible()
  }
}

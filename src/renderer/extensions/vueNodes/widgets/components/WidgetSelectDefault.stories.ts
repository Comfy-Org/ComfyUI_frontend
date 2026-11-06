import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { ref } from 'vue'

import WidgetSelectDefault from './WidgetSelectDefault.vue'

const meta = {
  title: 'Widgets/WidgetSelectDefault',
  component: WidgetSelectDefault,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    filenameSummary: true,
    modelValue: 'None',
    widget: {
      name: 'ckpt_name',
      type: 'combo',
      value: 'None',
      options: {
        values: [
          'None',
          'studio/models/portrait.safetensors',
          'studio/models/landscape.safetensors',
          'archive/portrait.safetensors'
        ]
      }
    },
    'onUpdate:modelValue': fn()
  },
  render: (args) => ({
    components: { WidgetSelectDefault },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <div class="flex w-80 flex-col gap-4 rounded-lg bg-node p-4">
        <output aria-label="Selected model" class="text-xs break-all text-muted-foreground">{{ value }}</output>
        <WidgetSelectDefault v-bind="args" v-model="value" />
      </div>
    `
  })
} satisfies Meta<typeof WidgetSelectDefault>

export default meta
type Story = StoryObj<typeof meta>

function labyrinthBranch(directory: string, depth: number): string[] {
  return [
    ...Array.from(
      { length: 3 },
      (_, index) => `${directory}/model-${index}.safetensors`
    ),
    ...(depth === 0
      ? []
      : Array.from({ length: 3 }, (_, index) =>
          labyrinthBranch(`${directory}/door-${index}`, depth - 1)
        ).flat())
  ]
}

const labyrinthCorridor = Array.from(
  { length: 48 },
  (_, index) => `turn-${String(index + 1).padStart(2, '0')}`
)
const labyrinthDeepFolder = [
  'Labyrinth',
  'vault',
  ...labyrinthCorridor.slice(0, 40)
].join('/')
const labyrinthOptions = [
  'None',
  ...labyrinthBranch('Labyrinth/atrium', 7),
  ...labyrinthCorridor.flatMap((_, index) => {
    const directory = [
      'Labyrinth',
      'vault',
      ...labyrinthCorridor.slice(0, index + 1)
    ].join('/')
    return [
      `${directory}/anchor.safetensors`,
      `${directory}/exit.safetensors`,
      ...Array.from({ length: 3 }, (_, branch) => [
        `${directory}/detour-${branch}/portrait.safetensors`,
        `${directory}/detour-${branch}/landscape.safetensors`
      ]).flat()
    ]
  })
]

export const Folders: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'ckpt_name' }))
    const popup = within(canvasElement.ownerDocument.body)
    await expect(
      popup.getByRole('option', { name: 'Folder: studio' })
    ).toBeVisible()
  }
}

export const NestedFolder: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: 'ckpt_name' })
    const popup = within(canvasElement.ownerDocument.body)
    await userEvent.click(trigger)
    await userEvent.click(popup.getByRole('option', { name: 'Folder: studio' }))
    await userEvent.click(popup.getByRole('option', { name: 'Folder: models' }))
    await userEvent.click(
      popup.getByRole('option', { name: 'Back: studio / models' })
    )
    await expect(
      popup.getByRole('option', { name: 'Folder: models' })
    ).toBeVisible()
    await expect(canvas.getByLabelText('Selected model')).toHaveTextContent(
      'None'
    )
    await userEvent.click(popup.getByRole('option', { name: 'Folder: models' }))
    await userEvent.click(
      popup.getByRole('option', { name: 'landscape.safetensors' })
    )
    await expect(canvas.getByLabelText('Selected model')).toHaveTextContent(
      'studio/models/landscape.safetensors'
    )
    await expect(trigger).toHaveTextContent('landscape.safetensors')
    await userEvent.click(trigger)
    await expect(
      popup.getByRole('option', {
        name: 'landscape.safetensors',
        selected: true
      })
    ).toBeVisible()
  }
}

export const EmptySearch: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const popup = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'ckpt_name' }))
    await userEvent.click(popup.getByRole('option', { name: 'Folder: studio' }))
    const search = popup.getByRole('combobox', { name: 'Search' })
    await userEvent.type(search, 'missing-model')
    await expect(popup.getByRole('status', { name: '' })).toHaveTextContent(
      'No Results Found'
    )
    await expect(search).not.toHaveAttribute('aria-activedescendant')
    await userEvent.clear(search)
    await expect(
      popup.getByRole('option', { name: 'Folder: models' })
    ).toBeVisible()
    await userEvent.type(search, 'missing-model')
    await expect(canvas.getByLabelText('Selected model')).toHaveTextContent(
      'None'
    )
  }
}

export const WindowsPaths: Story = {
  args: {
    widget: {
      ...meta.args.widget,
      options: {
        values: [
          'None',
          'studio\\models\\portrait.safetensors',
          'studio\\models\\landscape.safetensors'
        ]
      }
    }
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const popup = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox', { name: 'ckpt_name' })
    await userEvent.click(trigger)
    await userEvent.click(popup.getByRole('option', { name: 'Folder: studio' }))
    await userEvent.click(popup.getByRole('option', { name: 'Folder: models' }))
    await userEvent.click(
      popup.getByRole('option', { name: 'portrait.safetensors' })
    )
    await expect(canvas.getByLabelText('Selected model')).toHaveTextContent(
      'studio\\models\\portrait.safetensors'
    )
    await userEvent.click(trigger)
    await expect(
      popup.getByRole('option', {
        name: 'portrait.safetensors',
        selected: true
      })
    ).toBeVisible()
  }
}

export const DeepSearch: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const popup = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'ckpt_name' }))
    await userEvent.click(popup.getByRole('option', { name: 'Folder: studio' }))
    await userEvent.click(popup.getByRole('option', { name: 'Folder: models' }))
    await userEvent.type(
      popup.getByRole('combobox', { name: 'Search' }),
      'PORTRAIT'
    )
    await expect(
      popup.getByRole('option', { name: 'archive/portrait.safetensors' })
    ).toBeVisible()
    await expect(
      popup.getByRole('option', { name: 'studio/models/portrait.safetensors' })
    ).toBeVisible()
  }
}

export const SelectedFolder: Story = {
  args: {
    modelValue: 'studio/models/model_0999.safetensors',
    widget: {
      ...meta.args.widget,
      value: 'studio/models/model_0999.safetensors',
      options: {
        values: Array.from(
          { length: 1000 },
          (_, index) =>
            `studio/models/model_${String(index).padStart(4, '0')}.safetensors`
        )
      }
    }
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'ckpt_name' }))
    const popup = within(canvasElement.ownerDocument.body)
    const selected = await popup.findByRole('option', {
      name: 'model_0999.safetensors',
      selected: true
    })
    await waitFor(() =>
      expect(popup.getByRole('combobox', { name: 'Search' })).toHaveAttribute(
        'aria-activedescendant',
        selected.id
      )
    )
  }
}

export const ManyOptions: Story = {
  parameters: { layout: 'fullscreen' },
  args: {
    modelValue: 'model_00.safetensors',
    widget: {
      ...meta.args.widget,
      value: 'model_00.safetensors',
      options: {
        values: Array.from(
          { length: 40 },
          (_, index) => `model_${String(index).padStart(2, '0')}.safetensors`
        )
      }
    }
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'ckpt_name' }))
    const popup = within(canvasElement.ownerDocument.body)
    await waitFor(async () => {
      const viewport = popup.getByRole('listbox').getBoundingClientRect()
      const option = popup
        .getByRole('option', { name: 'model_14.safetensors' })
        .getBoundingClientRect()
      await expect(option.top).toBeGreaterThanOrEqual(viewport.top)
      await expect(option.bottom).toBeLessThanOrEqual(viewport.bottom)
    })
  }
}

export const Labyrinth: Story = {
  args: {
    modelValue: `${labyrinthDeepFolder}/anchor.safetensors`,
    widget: {
      name: 'ckpt_name',
      type: 'combo',
      value: `${labyrinthDeepFolder}/anchor.safetensors`,
      options: { values: labyrinthOptions }
    }
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const popup = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox', { name: 'ckpt_name' })
    const previous = canvas.getByRole('button', { name: 'ckpt_name: Previous' })
    const next = canvas.getByRole('button', { name: 'ckpt_name: Next' })
    await userEvent.click(trigger)
    await userEvent.click(popup.getByRole('button', { name: /^Lock folder:/ }))
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()
    const search = popup.getByRole('combobox', { name: 'Search' })
    await userEvent.type(search, 'atrium')
    await expect(popup.getByRole('status', { name: '' })).toHaveTextContent(
      'No Results Found'
    )
    await userEvent.tab({ shift: true })
    await expect(
      popup.getByRole('button', { name: /^Unlock folder:/ })
    ).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(search).toHaveFocus()
    await expect(search).toHaveValue('atrium')
    await expect(
      await popup.findByRole('option', {
        name: 'Labyrinth/atrium/model-0.safetensors'
      })
    ).toBeVisible()
    await userEvent.clear(search)
    await userEvent.click(popup.getByRole('button', { name: /^Lock folder:/ }))
    await userEvent.click(
      popup.getByRole('option', { name: 'exit.safetensors' })
    )
    await userEvent.click(previous)
    await expect(canvas.getByLabelText('Selected model')).toHaveTextContent(
      `${labyrinthDeepFolder}/anchor.safetensors`
    )
    await expect(previous).toBeDisabled()
    await userEvent.click(trigger)
    await expect(
      popup.getByRole('option', { name: 'Folder: turn-41' })
    ).toBeVisible()
    await expect(popup.queryByRole('option', { name: /^Back:/ })).toBeNull()
  }
}

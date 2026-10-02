import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

import EditorTiles from './EditorTiles.vue'

const OPTIONS = [
  { id: 'carpet', label: 'Red carpet', src: '/carpet.jpg' },
  { id: 'yacht', label: 'Yacht', src: '/yacht.jpg' }
] as const

function renderTiles(
  props: {
    columns?: 2 | 3 | 4
    busy?: boolean
    upload?: { label: string; caption?: string; inputTestId?: string }
  } = {}
) {
  const value = ref<string>('carpet')
  const { emitted } = render({
    setup: () => () =>
      h(EditorTiles<string>, {
        ...props,
        label: 'Scene',
        options: OPTIONS,
        modelValue: value.value,
        'onUpdate:modelValue': (next?: string) => {
          if (next) value.value = next
        },
        onUpload: (file: File) => uploads.push(file)
      })
  })
  const uploads: File[] = []
  return {
    value,
    uploads,
    emitted,
    group: screen.getByRole('radiogroup', { name: 'Scene' })
  }
}

describe('EditorTiles', () => {
  it('picks a tile and marks it checked', async () => {
    const { value, group } = renderTiles()

    await userEvent.click(within(group).getByRole('radio', { name: 'Yacht' }))

    expect(value.value).toBe('yacht')
    expect(within(group).getByRole('radio', { name: 'Yacht' })).toBeChecked()
    expect(
      within(group).getByRole('radio', { name: 'Red carpet' })
    ).not.toBeChecked()
  })

  it('holds placeholders while the options load', () => {
    const { group } = renderTiles({ busy: true })

    expect(group).toHaveAttribute('aria-busy', 'true')
    expect(within(group).queryAllByRole('radio')).toHaveLength(0)
  })

  it('ends with a tile that takes the visitor’s own image', async () => {
    const { group, uploads } = renderTiles({
      columns: 2,
      upload: {
        label: 'Upload your own scene',
        caption: 'Upload',
        inputTestId: 'scene-input'
      }
    })
    const own = new File(['x'], 'own.png', { type: 'image/png' })

    const tile = within(group).getByRole('button', {
      name: 'Upload your own scene'
    })
    expect(tile).toHaveTextContent('Upload')
    await userEvent.upload(screen.getByTestId('scene-input'), own)

    expect(uploads).toEqual([own])
  })
})

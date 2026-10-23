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
  const uploads: File[] = []
  const picks: string[] = []
  render({
    setup: () => () =>
      h(EditorTiles<string>, {
        ...props,
        label: 'Scene',
        options: OPTIONS,
        modelValue: value.value,
        'onUpdate:modelValue': (next?: string) => {
          if (next) value.value = next
        },
        onUpload: (file: File) => uploads.push(file),
        onPick: (id: string) => picks.push(id)
      })
  })
  return {
    value,
    uploads,
    picks,
    group: screen.getByRole('radiogroup', { name: 'Scene' })
  }
}

describe('EditorTiles', () => {
  it('picks a tile and marks it checked', async () => {
    const { value, group, picks } = renderTiles()

    await userEvent.click(within(group).getByRole('radio', { name: 'Yacht' }))
    await userEvent.click(within(group).getByRole('radio', { name: 'Yacht' }))

    expect(picks).toEqual(['yacht', 'yacht'])
    expect(value.value).toBe('yacht')
    expect(within(group).getByRole('radio', { name: 'Yacht' })).toBeChecked()
    expect(
      within(group).getByRole('radio', { name: 'Red carpet' })
    ).not.toBeChecked()
  })

  it('draws each option from its picture unless the tile slot draws it', () => {
    const { group } = renderTiles()

    const yacht = within(group).getByRole('radio', { name: 'Yacht' })
    expect(within(yacht).getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      '/yacht.jpg'
    )
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

  it('moves the pick and focus with the arrow keys, from a single tab stop', async () => {
    const { value } = renderTiles()

    await userEvent.tab()
    expect(screen.getByRole('radio', { name: 'Red carpet' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Yacht' })).toHaveAttribute(
      'tabindex',
      '-1'
    )

    await userEvent.keyboard('{ArrowRight}')

    expect(value.value).toBe('yacht')
    expect(screen.getByRole('radio', { name: 'Yacht' })).toHaveFocus()
  })
})

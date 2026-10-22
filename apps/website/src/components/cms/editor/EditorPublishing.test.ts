import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import EditorPublishing from './EditorPublishing.vue'

describe('editor publishing sidebar', () => {
  it('displays an existing offset schedule in UTC without saving or changing its precision', () => {
    const view = render(EditorPublishing, {
      props: {
        document: {
          enabled: false,
          visibility: 'staff',
          visible_from: '2026-10-15T09:30:45.123-07:00'
        }
      }
    })
    expect(screen.getByLabelText('Visible from (UTC)')).toHaveValue(
      '2026-10-15T16:30:45'
    )
    expect(screen.getByText(/Date and time are UTC/)).toBeVisible()
    expect(view.emitted('update')).toBeUndefined()
  })

  it('preserves all authored fields and exact pins when changing audience', async () => {
    const document = {
      enabled: false,
      visibility: 'staff',
      custom: { nested: ['keep'] },
      hero: { src: 'r2', id: 'logical-use', file_version_uid: 'exact' }
    }
    const view = render(EditorPublishing, { props: { document } })
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Audience' }),
        'public'
      )
    expect(view.emitted('update')).toEqual([
      [
        {
          ...document,
          visibility: 'public'
        }
      ]
    ])
    expect(document.visibility).toBe('staff')
  })

  it('keeps publication controls disabled while authoring is locked', async () => {
    const view = render(EditorPublishing, {
      props: {
        document: { enabled: true, visibility: 'public' },
        disabled: true
      }
    })
    await userEvent
      .setup()
      .click(screen.getByRole('checkbox', { name: 'Enabled' }))
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Audience' })).toBeDisabled()
    expect(screen.getByLabelText('Visible from (UTC)')).toBeDisabled()
    expect(view.emitted('update')).toBeUndefined()
  })
})

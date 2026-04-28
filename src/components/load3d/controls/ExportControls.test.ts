import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ExportControls from '@/components/load3d/controls/ExportControls.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { load3d: { exportModel: 'Export model' } }
  }
})

function renderComponent(onExportModel?: (format: string) => void) {
  const utils = render(ExportControls, {
    props: { onExportModel },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
  return { ...utils, user: userEvent.setup() }
}

describe('ExportControls', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the trigger button without exposing the format list initially', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Export model' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'GLB' })
    ).not.toBeInTheDocument()
  })

  it('reveals all three export format buttons when the trigger is clicked', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Export model' }))

    for (const label of ['GLB', 'OBJ', 'STL']) {
      expect(screen.getByRole('button', { name: label })).toBeVisible()
    }
  })

  it('emits exportModel with the chosen format and hides the popup', async () => {
    const onExportModel = vi.fn()
    const { user } = renderComponent(onExportModel)

    await user.click(screen.getByRole('button', { name: 'Export model' }))
    await user.click(screen.getByRole('button', { name: 'OBJ' }))

    expect(onExportModel).toHaveBeenCalledWith('obj')
    expect(
      screen.queryByRole('button', { name: 'GLB' })
    ).not.toBeInTheDocument()
  })

  it('hides the popup when a click happens outside the trigger', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Export model' }))
    expect(screen.getByRole('button', { name: 'GLB' })).toBeVisible()

    await user.click(document.body)

    expect(
      screen.queryByRole('button', { name: 'GLB' })
    ).not.toBeInTheDocument()
  })
})

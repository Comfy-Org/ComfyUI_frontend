import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useAssetExportStore } from '@/stores/assetExportStore'

import AssetExportProgressDialog from './AssetExportProgressDialog.vue'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderDialog() {
  const store = useAssetExportStore()
  store.trackExport('task-export-1')
  render(AssetExportProgressDialog, { global: { plugins: [i18n] } })
  return store
}

describe('AssetExportProgressDialog', () => {
  it('renders a cancelled export as cancelled rather than pending', async () => {
    const store = renderDialog()

    store.exportList[0].status = 'cancelled'
    await nextTick()

    // `cancelled` is a reachable export status because `DELETE /tasks/{id}` is
    // task-type agnostic. Falling through to the pending branch would report a
    // finished export as still queued.
    expect(screen.queryByText('Pending')).toBeNull()
    expect(screen.getAllByText('Cancelled')).not.toHaveLength(0)
    expect(screen.queryByText('All exports completed')).toBeNull()
  })

  it('still reports a completed export as completed', async () => {
    const store = renderDialog()

    store.exportList[0].status = 'completed'
    store.exportList[0].exportName = 'bundle.zip'
    await nextTick()

    expect(
      screen.getByText('All exports completed', { selector: 'span' })
    ).toBeVisible()
  })

  it('renders only while an export is tracked', async () => {
    render(AssetExportProgressDialog, { global: { plugins: [i18n] } })
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull()

    useAssetExportStore().trackExport('task-export-1')
    await nextTick()

    expect(screen.getByRole('button', { name: 'Expand' })).toBeVisible()
  })
})

describe('AssetExportProgressDialog announcements', () => {
  it.for([
    { status: 'running', announcement: 'Exporting Assets' },
    { status: 'failed', announcement: '1 export failed' },
    { status: 'completed', announcement: 'All exports completed' }
  ] as const)(
    'announces "$announcement" when the export is $status',
    async ({ status, announcement }) => {
      const store = renderDialog()

      store.exportList[0].status = status
      await nextTick()

      expect(
        screen.getByText(announcement, { selector: '[role="status"]' })
      ).toBeInTheDocument()
    }
  )
})

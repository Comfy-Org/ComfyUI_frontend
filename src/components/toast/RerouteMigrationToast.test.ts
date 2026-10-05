import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import Toaster from '@/components/ui/toast/Toaster.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'

import RerouteMigrationToast from './RerouteMigrationToast.vue'

describe('RerouteMigrationToast', () => {
  it('runs the migration and dismisses itself', async () => {
    const onMigrate = vi.fn(() => Promise.resolve())
    render(Toaster, { global: { plugins: [i18n] } })
    useToast().custom(RerouteMigrationToast, { onMigrate })
    await nextTick()

    await userEvent.click(screen.getByRole('button', { name: 'Migrate' }))

    expect(onMigrate).toHaveBeenCalledOnce()
    expect(useToast().toasts).toEqual([])
  })
})

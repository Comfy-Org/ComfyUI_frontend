import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useWorkspaceRename } from '@/platform/workspace/composables/useWorkspaceRename'

import WorkspaceSettingsHeader from './WorkspaceSettingsHeader.vue'

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...(actual as object), storeToRefs: (store: object) => store }
})

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    uiConfig: ref({ showEditWorkspaceMenuItem: true })
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    workspaceName: ref('Acme Team'),
    updateWorkspaceName: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('WorkspaceSettingsHeader', () => {
  afterEach(() => {
    useWorkspaceRename().stopRenaming()
  })

  it('labels the workspace rename input', () => {
    useWorkspaceRename().startRenaming()

    render(WorkspaceSettingsHeader, {
      global: {
        plugins: [i18n],
        directives: { tooltip: {} },
        stubs: { WorkspaceProfilePic: true }
      }
    })

    expect(
      screen.getByRole('textbox', { name: 'Workspace name' })
    ).toBeInTheDocument()
  })
})

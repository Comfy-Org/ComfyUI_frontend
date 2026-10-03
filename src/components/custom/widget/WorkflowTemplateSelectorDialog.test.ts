import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/scripts/app'))

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function renderPicker() {
  const pinia = getActivePinia()
  assert.exists(pinia)
  const dialogStore = useDialogStore()
  const afterClose = vi.fn()
  useWorkflowTemplateSelectorDialog().show('appbuilder', { afterClose })
  render(
    defineComponent({
      setup() {
        return () =>
          dialogStore.dialogStack.map((dialog) =>
            h(dialog.component, dialog.contentProps)
          )
      }
    }),
    {
      global: {
        plugins: [pinia, i18n],
        directives: { tooltip: {} },
        stubs: { ProgressSpinner: true }
      }
    }
  )
  return { afterClose }
}

beforeEach(() => {
  useSettingStore().settingValues = {
    'Comfy.Templates.SelectedModels': [],
    'Comfy.Templates.SelectedUseCases': [],
    'Comfy.Templates.SelectedRunsOn': [],
    'Comfy.Templates.SortBy': 'default'
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ nodes: [] }))
  )
  const store = useWorkflowTemplatesStore()
  store.isLoaded = true
  const templates: typeof store.enhancedTemplates = [
    {
      name: 'example',
      sourceModule: 'default',
      templateKey: 'example',
      title: 'Example',
      description: 'Example workflow',
      mediaType: 'image',
      mediaSubtype: 'png'
    }
  ]
  Object.assign(store, { enhancedTemplates: templates })
  vi.mocked(store.loadWorkflowTemplates).mockResolvedValue(undefined)
})

describe('template picker close lifecycle', () => {
  it.for([
    {
      outcome: 'success',
      loaded: true,
      settle: (load: ReturnType<typeof deferred<boolean>>) => load.resolve(true)
    },
    {
      outcome: 'rejection',
      loaded: false,
      settle: (load: ReturnType<typeof deferred<boolean>>) => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        load.reject(new Error('Graph load failed'))
      }
    },
    {
      outcome: 'false result',
      loaded: false,
      settle: (load: ReturnType<typeof deferred<boolean>>) =>
        load.resolve(false)
    }
  ])('finishes the closed session after graph load $outcome', async (row) => {
    const graphLoad = deferred<boolean>()
    vi.mocked(app.loadGraphData).mockReturnValueOnce(graphLoad.promise)
    const { afterClose } = renderPicker()

    await userEvent.click(
      await screen.findByTestId('template-workflow-example')
    )
    await waitFor(() =>
      expect(screen.queryByTestId('template-workflow-example')).toBeNull()
    )
    expect(afterClose).not.toHaveBeenCalled()

    row.settle(graphLoad)

    await waitFor(() => expect(afterClose).toHaveBeenCalledOnce())
    expect(
      useTelemetry()?.trackTemplateLibraryClosed
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ template_selected: row.loaded })
    )
  })

  it('keeps the picker open after a fetch failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { afterClose } = renderPicker()
    const template = await screen.findByTestId('template-workflow-example')
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Fetch failed'))

    await userEvent.click(template)
    await waitFor(() =>
      expect(useWorkflowTemplatesStore().loadingTemplateId).toBeNull()
    )

    expect(screen.getByTestId('template-workflow-example')).toBeInTheDocument()
    expect(afterClose).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackTemplateLibraryClosed).not.toHaveBeenCalled()
  })

  it('keeps a reopened picker open when another graph load is busy', async () => {
    const store = useWorkflowTemplatesStore()
    const controller = store.startTemplateLoad('previous')
    assert.exists(controller)
    store.startTemplateGraphLoad(controller)
    const { afterClose } = renderPicker()

    await userEvent.click(
      await screen.findByTestId('template-workflow-example')
    )

    expect(screen.getByTestId('template-workflow-example')).toBeInTheDocument()
    expect(afterClose).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackTemplateLibraryClosed).not.toHaveBeenCalled()
    expect(store.loadingTemplateId).toBe('previous')
  })
})

describe('custom templates that share a filename', () => {
  function renderDuplicates() {
    const duplicate = (pack: string) => ({
      name: 'decimate',
      sourceModule: pack,
      templateKey: `${pack}/decimate`,
      title: 'decimate',
      description: 'decimate',
      mediaType: 'image',
      mediaSubtype: 'jpg'
    })
    Object.assign(useWorkflowTemplatesStore(), {
      enhancedTemplates: [duplicate('pack-a'), duplicate('pack-b')]
    })
    renderPicker()
  }

  it('renders each pack and loads the clicked one from its own pack', async () => {
    renderDuplicates()

    expect(
      await screen.findByTestId('template-workflow-pack-a/decimate')
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByTestId('template-workflow-pack-b/decimate')
    )

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workflow_templates/pack-b/decimate.json'),
        expect.anything()
      )
    )
  })

  it('shows the loading spinner only on the card being loaded', async () => {
    const templateFetch = deferred<Response>()
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('/decimate.json')
        ? templateFetch.promise
        : Response.json({ nodes: [] })
    )
    renderDuplicates()

    await userEvent.click(
      await screen.findByTestId('template-workflow-pack-b/decimate')
    )

    expect(
      within(screen.getByTestId('template-workflow-pack-b/decimate')).getByRole(
        'progressbar'
      )
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByTestId('template-workflow-pack-a/decimate')
      ).queryByRole('progressbar')
    ).toBeNull()

    // Settle the load so no async work outlives the test (dialog closes).
    templateFetch.resolve(Response.json({ nodes: [] }))
    await waitFor(() => expect(app.loadGraphData).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.queryByTestId('template-workflow-pack-b/decimate')
      ).toBeNull()
    )
  })
})

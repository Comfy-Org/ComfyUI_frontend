import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useWorkflowTemplateSelectorDialog } from '@/platform/workflow/templates/composables/useWorkflowTemplateSelectorDialog'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@comfyorg/telemetry'))
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
  vi.mocked(fetch).mockImplementation(async () =>
    Response.json({ version: 0.4, nodes: [], links: [] })
  )
  const store = useWorkflowTemplatesStore()
  store.isLoaded = true
  const templates: typeof store.enhancedTemplates = [
    {
      name: 'example',
      sourceModule: 'default',
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

  it.for([
    { name: 'malformed', isRemote: false },
    {
      name: 'throwing',
      isRemote: () => {
        throw new Error('Host detection failed')
      }
    }
  ])(
    'cancels a selection after $name host detection and allows retry',
    async ({ isRemote }) => {
      const getTemplateInputAssets = vi.fn(async () => [])
      const downloadTemplateInputAsset = vi.fn()
      vi.stubGlobal('__comfyDesktop2', {
        isRemote,
        getTemplateInputAssets,
        downloadTemplateInputAsset
      })
      vi.mocked(app.loadGraphData).mockResolvedValue(true)
      const { afterClose } = renderPicker()
      const card = await screen.findByTestId('template-workflow-example')

      await userEvent.click(card)
      await waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
          surface: 'graph',
          errorType: 'error_loading_template'
        })
      )

      expect(useWorkflowTemplatesStore().loadingTemplateId).toBeNull()
      expect(card).toBeInTheDocument()
      expect(afterClose).not.toHaveBeenCalled()
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(getTemplateInputAssets).not.toHaveBeenCalled()
      expect(downloadTemplateInputAsset).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'POST' })
      )

      vi.stubGlobal('__comfyDesktop2', {
        isRemote: () => false,
        getTemplateInputAssets
      })
      await userEvent.click(card)
      await waitFor(() => expect(afterClose).toHaveBeenCalledOnce())

      expect(useWorkflowTemplatesStore().loadingTemplateId).toBeNull()
      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(downloadTemplateInputAsset).not.toHaveBeenCalled()
    }
  )

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

describe('template tags', () => {
  it('discloses the hidden tags on tap without opening the template', async () => {
    const store = useWorkflowTemplatesStore()
    Object.assign(store, {
      enhancedTemplates: store.enhancedTemplates.map((template) => ({
        ...template,
        tags: ['Image', 'Upscale', 'Video', 'Audio']
      }))
    })
    renderPicker()

    await userEvent.pointer({
      keys: '[TouchA]',
      target: await screen.findByRole('button', { name: 'Video, Audio' })
    })

    expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
      'Video, Audio'
    )
    expect(useWorkflowTemplatesStore().loadingTemplateId).toBeNull()
  })
})

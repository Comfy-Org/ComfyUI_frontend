import { render } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

function deferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

// Mock the API
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    fileURL: vi.fn((path) => `mock-file-url${path}`),
    apiURL: vi.fn((path) => `mock-api-url${path}`)
  }
}))

// loadGraphData resolves to the workflow it activated; the education card
// binds to that, so the mock returns a per-test workflow object.
const { mockLoadedWorkflow } = vi.hoisted(
  (): { mockLoadedWorkflow: { value: { key: string } | undefined } } => ({
    mockLoadedWorkflow: {
      value: { key: 'loaded-template' }
    }
  })
)

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    loadGraphData: vi.fn(() => Promise.resolve(mockLoadedWorkflow.value))
  }
}))

function mountTemplateWorkflows() {
  let loader: ReturnType<typeof useTemplateWorkflows> | undefined
  const { unmount } = render(
    defineComponent({
      setup() {
        loader = useTemplateWorkflows()
        return () => null
      }
    }),
    { global: { plugins: [i18n] } }
  )
  assert.exists(loader)
  return { loader, unmount }
}

// useTelemetry() returns null in OSS, a dispatcher in cloud — toggle via mockIsCloud.
const { mockIsCloud, mockTrackTemplate } = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockTrackTemplate: vi.fn()
}))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () =>
    mockIsCloud.value ? { trackTemplate: mockTrackTemplate } : null
}))

const { mockDistributionIsCloud } = vi.hoisted(() => ({
  mockDistributionIsCloud: { value: false }
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockDistributionIsCloud.value
  }
}))

type MockWorkflowTemplatesStore = ReturnType<typeof useWorkflowTemplatesStore>

beforeEach(() => {
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
})

describe('useTemplateWorkflows', () => {
  let mockWorkflowTemplatesStore: MockWorkflowTemplatesStore

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ workflow: 'data' }))
    )
    mockIsCloud.value = true
    mockDistributionIsCloud.value = false
    mockLoadedWorkflow.value = { key: 'loaded-template' }

    mockWorkflowTemplatesStore = useWorkflowTemplatesStore()
    vi.mocked(
      mockWorkflowTemplatesStore.loadWorkflowTemplates
    ).mockResolvedValue(undefined)
    Object.assign(mockWorkflowTemplatesStore, {
      isLoaded: false,
      enhancedTemplates: [],
      groupedTemplates: [
        {
          label: 'ComfyUI Examples',
          modules: [
            {
              moduleName: 'all',
              title: 'All',
              localizedTitle: 'All Templates',
              templates: [
                {
                  name: 'template1',
                  mediaType: 'image',
                  mediaSubtype: 'jpg',
                  sourceModule: 'default',
                  localizedTitle: 'Template 1',
                  description: 'Template 1 description'
                },
                {
                  name: 'template2',
                  mediaType: 'image',
                  mediaSubtype: 'jpg',
                  sourceModule: 'custom-module',
                  description: 'A custom template'
                }
              ]
            },
            {
              moduleName: 'default',
              title: 'Default',
              localizedTitle: 'Default Templates',
              templates: [
                {
                  name: 'template1',
                  mediaType: 'image',
                  mediaSubtype: 'jpg',
                  localizedTitle: 'Template 1',
                  localizedDescription: 'A default template',
                  description: 'Template 1 description'
                }
              ]
            }
          ]
        }
      ]
    })
  })

  it('should load templates from store', async () => {
    const { loadTemplates, isTemplatesLoaded } = mountTemplateWorkflows().loader

    expect(isTemplatesLoaded.value).toBe(false)

    await loadTemplates()

    expect(mockWorkflowTemplatesStore.loadWorkflowTemplates).toHaveBeenCalled()
  })

  it('reports a template load failure when the catalog could not be loaded', async () => {
    const { loader } = mountTemplateWorkflows()

    expect(await loader.loadTemplates()).toBe(false)
    expect(await loader.loadWorkflowTemplate('template1', 'default')).toBe(
      'not-started'
    )

    expect(useToastStore().messagesToAdd).toEqual([
      {
        severity: 'error',
        summary: i18n.global.t('g.error'),
        detail: i18n.global.t('templateWorkflows.error.loading')
      }
    ])
    expect(fetch).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it('should select the first template category', () => {
    const { selectFirstTemplateCategory, selectedTemplate } =
      mountTemplateWorkflows().loader

    selectFirstTemplateCategory()

    expect(selectedTemplate.value).toEqual(
      mockWorkflowTemplatesStore.groupedTemplates[0].modules[0]
    )
  })

  it('reports an unknown template in the All category without starting a load', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const { loader } = mountTemplateWorkflows()

    expect(await loader.loadWorkflowTemplate('missing', 'all')).toBe(
      'not-started'
    )

    expect(useToastStore().messagesToAdd).toEqual([
      {
        severity: 'error',
        summary: i18n.global.t('g.error'),
        detail: i18n.global.t('templateWorkflows.error.templateNotFound', {
          templateName: 'missing'
        })
      }
    ])
    expect(fetch).not.toHaveBeenCalled()
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it('should select a template category', () => {
    const { selectTemplateCategory, selectedTemplate } =
      mountTemplateWorkflows().loader
    const category = mockWorkflowTemplatesStore.groupedTemplates[0].modules[1] // Default category

    const result = selectTemplateCategory(category)

    expect(result).toBe(true)
    expect(selectedTemplate.value).toEqual(category)
  })

  it('should format template thumbnails correctly for default templates', () => {
    const { getTemplateThumbnailUrl } = mountTemplateWorkflows().loader
    const template = {
      name: 'test-template',
      mediaSubtype: 'jpg',
      mediaType: 'image',
      description: 'Test template'
    }

    const url = getTemplateThumbnailUrl(template, 'default', '1')

    expect(url).toBe('mock-file-url/templates/test-template-1.jpg')
  })

  it('should format template thumbnails correctly for custom templates', () => {
    const { getTemplateThumbnailUrl } = mountTemplateWorkflows().loader
    const template = {
      name: 'test-template',
      mediaSubtype: 'jpg',
      mediaType: 'image',
      description: 'Test template'
    }

    const url = getTemplateThumbnailUrl(template, 'custom-module')

    expect(url).toBe(
      'mock-api-url/workflow_templates/custom-module/test-template.jpg'
    )
  })

  it('should format template titles correctly', () => {
    const { getTemplateTitle } = mountTemplateWorkflows().loader

    // Default template with localized title
    const titleWithLocalized = getTemplateTitle(
      {
        name: 'test',
        localizedTitle: 'Localized Title',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'default'
    )
    expect(titleWithLocalized).toBe('Localized Title')

    // Default template without localized title
    const titleWithFallback = getTemplateTitle(
      {
        name: 'test',
        title: 'Title',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'default'
    )
    expect(titleWithFallback).toBe('Title')

    // Custom template
    const customTitle = getTemplateTitle(
      {
        name: 'test-template',
        title: 'Custom Title',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'custom-module'
    )
    expect(customTitle).toBe('Custom Title')

    // Fallback to name
    const nameOnly = getTemplateTitle(
      {
        name: 'name-only',
        mediaType: 'image',
        mediaSubtype: 'jpg',
        description: 'Test'
      },
      'custom-module'
    )
    expect(nameOnly).toBe('name-only')
  })

  it('should format template descriptions correctly', () => {
    const { getTemplateDescription } = mountTemplateWorkflows().loader

    // Default template with localized description
    const descWithLocalized = getTemplateDescription({
      name: 'test',
      localizedDescription: 'Localized Description',
      mediaType: 'image',
      mediaSubtype: 'jpg',
      description: 'Test'
    })
    expect(descWithLocalized).toBe('Localized Description')

    // Custom template with description
    const customDesc = getTemplateDescription({
      name: 'test',
      description: 'custom-template_description',
      mediaType: 'image',
      mediaSubtype: 'jpg'
    })
    expect(customDesc).toBe('custom template description')
  })

  it('should load a template from the "All" category', async () => {
    const { loadWorkflowTemplate, loadingTemplateId } =
      mountTemplateWorkflows().loader

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Load a template from the "All" category
    const result = await loadWorkflowTemplate('template1', 'all')
    await flushPromises()

    expect(result).toBe('loaded')
    expect(fetch).toHaveBeenCalledWith(
      'mock-file-url/templates/template1.json',
      {
        signal: expect.any(AbortSignal)
      }
    )
    expect(loadingTemplateId.value).toBe(null) // Should reset after loading
  })

  it('should load a template from a regular category', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Load a template from the default category
    const result = await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(result).toBe('loaded')
    expect(fetch).toHaveBeenCalledWith(
      'mock-file-url/templates/template1.json',
      {
        signal: expect.any(AbortSignal)
      }
    )
  })

  it('tracks template telemetry on load in cloud builds', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader

    mockWorkflowTemplatesStore.isLoaded = true
    await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(mockTrackTemplate).toHaveBeenCalledWith({
      workflow_name: 'template1',
      template_source: 'default'
    })
  })

  it('does not fire template telemetry in OSS builds', async () => {
    mockIsCloud.value = false
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader

    mockWorkflowTemplatesStore.isLoaded = true
    await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(mockTrackTemplate).not.toHaveBeenCalled()
  })

  const enhancedTemplate = (isPartnerNode: boolean, name = 'template1') => {
    type EnhancedTemplateLike =
      MockWorkflowTemplatesStore['enhancedTemplates'][number]
    return {
      name,
      sourceModule: 'default',
      isPartnerNode
    } as Partial<EnhancedTemplateLike> as EnhancedTemplateLike
  }

  it('requests the partner education card when a paid template loads locally', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().requestedForWorkflowKey).toBe(
      'loaded-template'
    )
  })

  it('retires the card instead of requesting it when no workflow was activated', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))
    usePartnerNodesEducationStore().requestedForWorkflowKey =
      'previous-template'
    mockLoadedWorkflow.value = undefined

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().isCardRequested).toBe(false)
  })

  it('binds to the workflow this load activated, resolved by loadGraphData', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))

    // loadGraphData resolves to the workflow it activated even if the user has
    // since switched tabs during its asset-scan window, so the card binds to
    // that workflow rather than whichever one is globally active now.
    mockLoadedWorkflow.value = { key: 'template-a' }

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().requestedForWorkflowKey).toBe(
      'template-a'
    )
  })

  it('does not request the education card for open-source templates', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(false))

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().isCardRequested).toBe(false)
  })

  it('retires an earlier request when an open-source template loads next', async () => {
    const { loadWorkflowTemplate } = mountTemplateWorkflows().loader
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(
      enhancedTemplate(true),
      enhancedTemplate(false, 'template2')
    )

    await loadWorkflowTemplate('template1', 'default')
    expect(usePartnerNodesEducationStore().requestedForWorkflowKey).toBe(
      'loaded-template'
    )

    // The open-source template may still contain partner nodes, so the card
    // would otherwise linger and describe the wrong template.
    await loadWorkflowTemplate('template2', 'default')
    expect(usePartnerNodesEducationStore().isCardRequested).toBe(false)
  })

  it('should handle errors when loading templates', async () => {
    const { loader } = mountTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    const error = new Error('Failed to fetch')
    vi.mocked(fetch).mockRejectedValueOnce(error)

    const result = await loader.loadWorkflowTemplate(
      'error-template',
      'default'
    )

    expect(result).toBe('not-started')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      errorType: 'error_loading_template'
    })
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it('keeps the busy state until graph loading completes and rejects a second load', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const loaded = deferred<Awaited<ReturnType<typeof app.loadGraphData>>>()
    vi.mocked(app.loadGraphData).mockReturnValue(loaded.promise)
    const { loader } = mountTemplateWorkflows()
    const first = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
    expect(loader.loadingTemplateId.value).toBe('template1')
    expect(await loader.loadWorkflowTemplate('template2', 'default')).toBe(
      'not-started'
    )
    expect(app.loadGraphData).toHaveBeenCalledOnce()
    loaded.resolve(true)
    expect(await first).toBe('loaded')
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it('keeps a reopened picker busy until the previous graph load completes', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const loaded = deferred<Awaited<ReturnType<typeof app.loadGraphData>>>()
    vi.mocked(app.loadGraphData).mockReturnValueOnce(loaded.promise)
    const { loader, unmount } = mountTemplateWorkflows()
    const first = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
    unmount()

    const { loader: reopenedLoader } = mountTemplateWorkflows()
    expect(reopenedLoader.loadingTemplateId.value).toBe('template1')
    expect(
      await reopenedLoader.loadWorkflowTemplate('template2', 'default')
    ).toBe('not-started')
    expect(app.loadGraphData).toHaveBeenCalledOnce()

    loaded.resolve(true)
    expect(await first).toBe('loaded')
    expect(reopenedLoader.loadingTemplateId.value).toBeNull()
    expect(
      await reopenedLoader.loadWorkflowTemplate('template2', 'default')
    ).toBe('loaded')
  })

  it('reports a graph failure after rejecting another loader and permits a retry', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const error = new Error('Graph configuration failed')
    const failure = deferred<Error>()
    vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
      throw await failure.promise
    })
    const { loader } = mountTemplateWorkflows()
    const first = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
    const { loader: nextLoader } = mountTemplateWorkflows()
    const second = await nextLoader.loadWorkflowTemplate('template2', 'default')
    failure.resolve(error)
    expect(await first).toBe('graph-failed')

    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      errorType: 'error_loading_template'
    })
    expect(useToastStore().messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'error',
        detail: i18n.global.t('templateWorkflows.error.loading')
      })
    ])
    expect(second).toBe('not-started')
    expect(nextLoader.loadingTemplateId.value).toBeNull()
    expect(await nextLoader.loadWorkflowTemplate('template2', 'default')).toBe(
      'loaded'
    )
  })

  it('keeps a replacement fetch active when the superseded loader unmounts and finishes', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const firstJson = deferred<Response>()
    const secondJson = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(firstJson.promise)
      .mockReturnValueOnce(secondJson.promise)
    const { loader, unmount } = mountTemplateWorkflows()
    const first = loader.loadWorkflowTemplate('template1', 'default')
    const { loader: nextLoader } = mountTemplateWorkflows()
    const second = nextLoader.loadWorkflowTemplate('template2', 'default')

    unmount()
    firstJson.resolve(Response.json({ workflow: 'first' }))
    expect(await first).toBe('not-started')
    expect(nextLoader.loadingTemplateId.value).toBe('template2')

    secondJson.resolve(Response.json({ workflow: 'second' }))
    expect(await second).toBe('loaded')
    expect(app.loadGraphData).toHaveBeenCalledOnce()
    expect(nextLoader.loadingTemplateId.value).toBeNull()
    expect(useToastStore().messagesToAdd).toEqual([])
  })

  it('does not open the workflow when the loader unmounts while fetching the template', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const templateJson = deferred<Response>()
    vi.mocked(fetch).mockImplementation(() => templateJson.promise)
    const { loader, unmount } = mountTemplateWorkflows()
    const result = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    unmount()
    templateJson.resolve(Response.json({ workflow: 'data' }))
    expect(await result).toBe('not-started')
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it.for(['default', 'custom-module'])(
    'aborts the %s template request and clears busy state on unmount',
    async (sourceModule) => {
      mockWorkflowTemplatesStore.isLoaded = true
      let requestSignal: AbortSignal | null | undefined
      vi.mocked(fetch).mockImplementation((_url, options) => {
        requestSignal = options?.signal
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          )
        })
      })
      const { loader, unmount } = mountTemplateWorkflows()

      const result = loader.loadWorkflowTemplate('template1', sourceModule)
      expect(requestSignal).toBeInstanceOf(AbortSignal)
      unmount()

      expect(await result).toBe('not-started')
      expect(requestSignal?.aborted).toBe(true)
      expect(loader.loadingTemplateId.value).toBeNull()
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(useToastStore().messagesToAdd).toEqual([])
    }
  )

  it('continues graph loading when closing the selector unmounts the loader', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const { loader, unmount } = mountTemplateWorkflows()
    vi.mocked(useDialogStore().closeDialog).mockImplementation(() => unmount())
    expect(await loader.loadWorkflowTemplate('template1', 'default')).toBe(
      'loaded'
    )
    expect(app.loadGraphData).toHaveBeenCalledOnce()
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it.for([
    {
      instance: 'same',
      getLoader: (loader: ReturnType<typeof useTemplateWorkflows>) => loader
    },
    {
      instance: 'separate',
      getLoader: () => mountTemplateWorkflows().loader
    }
  ])(
    'does not open an older template after a newer selection finishes in the $instance instance',
    async ({ getLoader }) => {
      mockWorkflowTemplatesStore.isLoaded = true
      const templateJson = deferred<Response>()
      vi.mocked(fetch).mockImplementation((url) =>
        String(url).includes('template1')
          ? templateJson.promise
          : Promise.resolve(Response.json({ workflow: 'data' }))
      )
      const { loader } = mountTemplateWorkflows()
      const first = loader.loadWorkflowTemplate('template1', 'default')
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      const nextLoader = getLoader(loader)
      expect(
        await nextLoader.loadWorkflowTemplate('template2', 'default')
      ).toBe('loaded')
      templateJson.resolve(Response.json({ workflow: 'data' }))
      expect(await first).toBe('not-started')

      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      expect(
        useToastStore().messagesToAdd.filter(
          (message) => message.severity === 'error'
        )
      ).toEqual([])
    }
  )
})

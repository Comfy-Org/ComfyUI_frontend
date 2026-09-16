import { useDialogStore } from '@/stores/dialogStore'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent } from 'vue'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useTemplateWorkflows as createTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

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
    addEventListener: vi.fn(),
    getServerFeature: vi.fn(() => false),
    internalURL: vi.fn((path) => `mock-internal-url${path}`),
    fileURL: vi.fn((path) => `mock-file-url${path}`),
    apiURL: vi.fn((path) => `mock-api-url${path}`),
    fetchApi: vi.fn(async () =>
      Response.json({ name: 'kitten_cop.mp4', type: 'input' })
    )
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
    loadGraphData: vi.fn(() => Promise.resolve(mockLoadedWorkflow.value)),
    reloadNodeDefs: vi.fn(async () => {})
  }
}))

const apps: App<Element>[] = []

function useTemplateWorkflows() {
  let result: ReturnType<typeof createTemplateWorkflows> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createTemplateWorkflows()
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('Template workflows were not initialized')
  return result
}

afterEach(() => apps.splice(0).forEach((app) => app.unmount()))

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
    const { loadTemplates, isTemplatesLoaded } = useTemplateWorkflows()

    expect(isTemplatesLoaded.value).toBe(false)

    await loadTemplates()

    expect(mockWorkflowTemplatesStore.loadWorkflowTemplates).toHaveBeenCalled()
  })

  it('reports a template load failure when the catalog could not be loaded', async () => {
    const loader = useTemplateWorkflows()

    expect(await loader.loadTemplates()).toBe(false)
    expect(await loader.loadWorkflowTemplate('template1', 'default')).toBe(
      false
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
      useTemplateWorkflows()

    selectFirstTemplateCategory()

    expect(selectedTemplate.value).toEqual(
      mockWorkflowTemplatesStore.groupedTemplates[0].modules[0]
    )
  })

  it('should select a template category', () => {
    const { selectTemplateCategory, selectedTemplate } = useTemplateWorkflows()
    const category = mockWorkflowTemplatesStore.groupedTemplates[0].modules[1] // Default category

    const result = selectTemplateCategory(category)

    expect(result).toBe(true)
    expect(selectedTemplate.value).toEqual(category)
  })

  it('should format template thumbnails correctly for default templates', () => {
    const { getTemplateThumbnailUrl } = useTemplateWorkflows()
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
    const { getTemplateThumbnailUrl } = useTemplateWorkflows()
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
    const { getTemplateTitle } = useTemplateWorkflows()

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
    const { getTemplateDescription } = useTemplateWorkflows()

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
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Load a template from the "All" category
    const result = await loadWorkflowTemplate('template1', 'all')
    await flushPromises()

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'mock-file-url/templates/template1.json',
      {
        signal: expect.any(AbortSignal)
      }
    )
    expect(loadingTemplateId.value).toBe(null) // Should reset after loading
  })

  it('should load a template from a regular category', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Load a template from the default category
    const result = await loadWorkflowTemplate('template1', 'default')
    await flushPromises()

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'mock-file-url/templates/template1.json',
      {
        signal: expect.any(AbortSignal)
      }
    )
  })

  it('tracks template telemetry on load in cloud builds', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()

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
    const { loadWorkflowTemplate } = useTemplateWorkflows()

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
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().requestedForWorkflowKey).toBe(
      'loaded-template'
    )
  })

  it('retires the card instead of requesting it when no workflow was activated', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(true))
    usePartnerNodesEducationStore().requestedForWorkflowKey =
      'previous-template'
    mockLoadedWorkflow.value = undefined

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().isCardRequested).toBe(false)
  })

  it('binds to the workflow this load activated, resolved by loadGraphData', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
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
    const { loadWorkflowTemplate } = useTemplateWorkflows()
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push(enhancedTemplate(false))

    await loadWorkflowTemplate('template1', 'default')

    expect(usePartnerNodesEducationStore().isCardRequested).toBe(false)
  })

  it('retires an earlier request when an open-source template loads next', async () => {
    const { loadWorkflowTemplate } = useTemplateWorkflows()
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
    const { loadWorkflowTemplate, loadingTemplateId } = useTemplateWorkflows()

    // Set the store as loaded
    mockWorkflowTemplatesStore.isLoaded = true

    // Mock fetch to throw an error
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Load a template that will fail
    const result = await loadWorkflowTemplate('error-template', 'default')

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()
    expect(loadingTemplateId.value).toBe(null) // Should reset even after error

    // Restore console.error
    consoleSpy.mockRestore()
  })

  function addVideoTemplate(
    sourceRevision: string | null = '0123456789abcdef0123456789abcdef01234567'
  ) {
    mockWorkflowTemplatesStore.isLoaded = true
    mockWorkflowTemplatesStore.enhancedTemplates.push({
      name: 'video',
      sourceModule: 'default',
      description: 'Video editing',
      mediaType: 'image',
      mediaSubtype: 'webp',
      io: {
        inputs: [
          {
            nodeId: 35,
            nodeType: 'LoadVideo',
            file: 'kitten_cop.mp4',
            mediaType: 'video',
            sourceRevision: sourceRevision ?? undefined
          }
        ]
      }
    })
    const graph: ComfyWorkflowJSON = {
      version: 0.4,
      last_node_id: 35,
      last_link_id: 0,
      links: [],
      nodes: [
        {
          id: 35,
          type: 'LoadVideo',
          pos: [0, 0],
          size: [300, 200],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: ['kitten_cop.mp4', 'image'],
          widgets_values_named: { file: 'kitten_cop.mp4', upload: 'image' }
        }
      ]
    }
    vi.mocked(fetch).mockImplementation(async () => Response.json(graph))
    return graph
  }

  it('keeps the graph closed until sample upload and file-list refresh complete', async () => {
    const graph = addVideoTemplate()
    const download = deferred<Response>()
    const started = deferred<void>()
    vi.mocked(fetch).mockImplementation((url) => {
      if (String(url).startsWith('mock-internal-url'))
        return Promise.resolve(Response.json([]))
      if (String(url).endsWith('.mp4')) {
        started.resolve()
        return download.promise
      }
      return Promise.resolve(Response.json(graph))
    })
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({ name: 'kitten_cop (1).mp4', type: 'input' })
    )
    const refreshed = deferred<void>()
    vi.mocked(app.reloadNodeDefs).mockImplementation(() => refreshed.promise)
    const loader = useTemplateWorkflows()
    const result = loader.loadWorkflowTemplate('video', 'default')
    await started.promise
    expect(loader.loadingTemplateId.value).toBe('video')
    expect(app.loadGraphData).not.toHaveBeenCalled()
    download.resolve(new Response('video'))
    await vi.waitFor(() => expect(app.reloadNodeDefs).toHaveBeenCalled())
    expect(app.loadGraphData).not.toHaveBeenCalled()
    refreshed.resolve()
    expect(await result).toBe(true)
    expect(app.loadGraphData).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            widgets_values: ['kitten_cop (1).mp4', 'image']
          })
        ]
      }),
      true,
      true,
      expect.any(String),
      { openSource: 'template' }
    )
  })

  it.for([null, 'main'])(
    'opens a template without downloading unversioned samples (revision: %s)',
    async (revision) => {
      const graph = addVideoTemplate(revision)
      const loader = useTemplateWorkflows()
      expect(await loader.loadWorkflowTemplate('video', 'default')).toBe(true)
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(app.reloadNodeDefs).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.objectContaining({ nodes: graph.nodes }),
        true,
        true,
        expect.any(String),
        { openSource: 'template' }
      )
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(useToastStore().messagesToAdd).not.toContainEqual(
        expect.objectContaining({ severity: 'info' })
      )
    }
  )

  it.for([null, '0123456789abcdef0123456789abcdef01234567'])(
    'opens legacy subgraph templates without preparing media (revision: %s)',
    async (revision) => {
      const graph: unknown = {
        ...addVideoTemplate(revision),
        definitions: {
          subgraphs: [
            {
              id: '7a06a6de-067d-4d41-b7bf-7d6add20ec8c',
              version: 1,
              revision: 0,
              name: 'Legacy subgraph',
              state: {
                lastGroupId: 0,
                lastNodeId: 0,
                lastLinkId: 0,
                lastRerouteId: 0
              },
              nodes: [],
              inputNode: { id: -10, bounding: [0, 0, 100, 100] },
              outputNode: { id: -20, bounding: [200, 0, 100, 100] },
              inputs: [{ id: 'image1', name: 'image1', type: 'IMAGE' }]
            }
          ]
        }
      }
      vi.mocked(fetch).mockImplementation(async () => Response.json(graph))
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const loader = useTemplateWorkflows()

      expect(await loader.loadWorkflowTemplate('video', 'default')).toBe(true)
      expect(app.loadGraphData).toHaveBeenCalledWith(
        graph,
        true,
        true,
        expect.any(String),
        { openSource: 'template' }
      )
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(useToastStore().messagesToAdd).not.toContainEqual(
        expect.objectContaining({ severity: 'error' })
      )
    }
  )

  it.for(['http', 'network', 'timeout', 'upload', 'unsupported'])(
    'opens the workflow when optional sample preparation fails: %s',
    async (failure) => {
      const graph = addVideoTemplate()
      if (failure === 'unsupported') {
        const template = mockWorkflowTemplatesStore.enhancedTemplates.find(
          (item) => item.name === 'video'
        )
        const input = template?.io?.inputs?.[0]
        if (!input) throw new Error('Missing sample input')
        input.file = '../kitten_cop.mp4'
        graph.nodes[0].widgets_values = ['../kitten_cop.mp4', 'image']
        graph.nodes[0].widgets_values_named = { file: '../kitten_cop.mp4' }
      }
      vi.mocked(fetch).mockImplementation(async (url) => {
        if (!String(url).endsWith('.mp4')) return Response.json(graph)
        if (failure === 'network') throw new TypeError('Network unavailable')
        if (failure === 'timeout')
          throw new DOMException('Sample timed out', 'TimeoutError')
        return failure === 'http'
          ? new Response('Not found', { status: 404 })
          : new Response('video')
      })
      if (failure === 'upload')
        vi.mocked(api.fetchApi).mockResolvedValue(
          new Response('', { status: 500 })
        )
      const loader = useTemplateWorkflows()
      expect(await loader.loadWorkflowTemplate('video', 'default')).toBe(true)
      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.objectContaining({ nodes: graph.nodes }),
        true,
        true,
        expect.any(String),
        { openSource: 'template' }
      )
      expect(useDialogStore().closeDialog).toHaveBeenCalled()
      expect(useToastStore().messagesToAdd).toContainEqual(
        expect.objectContaining({
          severity: 'warn',
          detail: expect.stringContaining('choose your own files')
        })
      )
    }
  )

  it('opens with the uploaded filename even if refreshing node definitions fails', async () => {
    const graph = addVideoTemplate()
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('.mp4')
        ? new Response('video')
        : Response.json(graph)
    )
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({ name: 'saved.mp4' })
    )
    vi.mocked(app.reloadNodeDefs).mockRejectedValue(new Error('Refresh failed'))
    expect(
      await useTemplateWorkflows().loadWorkflowTemplate('video', 'default')
    ).toBe(true)
    expect(app.loadGraphData).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({ widgets_values: ['saved.mp4', 'image'] })
        ]
      }),
      true,
      true,
      expect.any(String),
      { openSource: 'template' }
    )
  })

  it('keeps the busy state until graph loading completes and rejects a second load', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const loaded = deferred<Awaited<ReturnType<typeof app.loadGraphData>>>()
    vi.mocked(app.loadGraphData).mockReturnValue(loaded.promise)
    const loader = useTemplateWorkflows()
    const first = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
    expect(loader.loadingTemplateId.value).toBe('template1')
    expect(await loader.loadWorkflowTemplate('template2', 'default')).toBe(
      false
    )
    expect(app.loadGraphData).toHaveBeenCalledOnce()
    loaded.resolve(true)
    expect(await first).toBe(true)
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it('keeps a reopened picker busy until the previous graph load completes', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const loaded = deferred<Awaited<ReturnType<typeof app.loadGraphData>>>()
    vi.mocked(app.loadGraphData).mockReturnValueOnce(loaded.promise)
    const loader = useTemplateWorkflows()
    const component = apps.pop()
    assert.exists(component)
    const first = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
    component.unmount()

    const reopenedLoader = useTemplateWorkflows()
    expect(reopenedLoader.loadingTemplateId.value).toBe('template1')
    expect(
      await reopenedLoader.loadWorkflowTemplate('template2', 'default')
    ).toBe(false)
    expect(app.loadGraphData).toHaveBeenCalledOnce()

    loaded.resolve(true)
    expect(await first).toBe(true)
    expect(reopenedLoader.loadingTemplateId.value).toBeNull()
    expect(
      await reopenedLoader.loadWorkflowTemplate('template2', 'default')
    ).toBe(true)
  })

  it('reports a graph failure after rejecting another loader and permits a retry', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = deferred<Error>()
    vi.mocked(app.loadGraphData).mockImplementationOnce(async () => {
      throw await failure.promise
    })
    const loader = useTemplateWorkflows()
    const first = loader.loadWorkflowTemplate('template1', 'default')
    await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
    const nextLoader = useTemplateWorkflows()
    const second = await nextLoader.loadWorkflowTemplate('template2', 'default')
    failure.resolve(new Error('Graph configuration failed'))
    expect(await first).toBe(false)

    expect(consoleError).toHaveBeenCalledOnce()
    expect(useToastStore().messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'error',
        detail: i18n.global.t('templateWorkflows.error.loading')
      })
    ])
    expect(second).toBe(false)
    expect(nextLoader.loadingTemplateId.value).toBeNull()
    expect(await nextLoader.loadWorkflowTemplate('template2', 'default')).toBe(
      true
    )
  })

  it('keeps a replacement fetch active when the superseded loader unmounts and finishes', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const firstJson = deferred<Response>()
    const secondJson = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(firstJson.promise)
      .mockReturnValueOnce(secondJson.promise)
    const loader = useTemplateWorkflows()
    const component = apps.pop()
    assert.exists(component)
    const first = loader.loadWorkflowTemplate('template1', 'default')
    const nextLoader = useTemplateWorkflows()
    const second = nextLoader.loadWorkflowTemplate('template2', 'default')

    component.unmount()
    firstJson.resolve(Response.json({ workflow: 'first' }))
    expect(await first).toBe(false)
    expect(nextLoader.loadingTemplateId.value).toBe('template2')

    secondJson.resolve(Response.json({ workflow: 'second' }))
    expect(await second).toBe(true)
    expect(app.loadGraphData).toHaveBeenCalledOnce()
    expect(nextLoader.loadingTemplateId.value).toBeNull()
    expect(useToastStore().messagesToAdd).toEqual([])
  })

  it('does not open the workflow when the loader unmounts while fetching the template', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const templateJson = deferred<Response>()
    vi.mocked(fetch).mockImplementation(() => templateJson.promise)
    const loader = useTemplateWorkflows()
    const component = apps.pop()
    if (!component) throw new Error('Missing loader component')
    const onGraphLoadSettled = vi.fn()
    const result = loader.loadWorkflowTemplate('template1', 'default', {
      onGraphLoadSettled
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    component.unmount()
    templateJson.resolve(Response.json({ workflow: 'data' }))
    expect(await result).toBe(false)
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(loader.loadingTemplateId.value).toBeNull()
    expect(onGraphLoadSettled).not.toHaveBeenCalled()
  })

  it('does not open the workflow when the loader unmounts during preparation', async () => {
    const graph = addVideoTemplate()
    const download = deferred<Response>()
    const started = deferred<void>()
    vi.mocked(fetch).mockImplementation((url) => {
      if (String(url).endsWith('.mp4')) {
        started.resolve()
        return download.promise
      }
      return Promise.resolve(Response.json(graph))
    })
    const loader = useTemplateWorkflows()
    const component = apps.pop()
    if (!component) throw new Error('Missing loader component')
    const result = loader.loadWorkflowTemplate('video', 'default')
    await started.promise
    component.unmount()
    download.resolve(new Response('video'))
    expect(await result).toBe(false)
    expect(app.loadGraphData).not.toHaveBeenCalled()
    expect(api.fetchApi).not.toHaveBeenCalled()
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
      const loader = useTemplateWorkflows()

      const result = loader.loadWorkflowTemplate('template1', sourceModule)
      expect(requestSignal).toBeInstanceOf(AbortSignal)
      const component = apps.pop()
      if (!component) throw new Error('Missing loader component')
      component.unmount()

      expect(await result).toBe(false)
      expect(requestSignal?.aborted).toBe(true)
      expect(loader.loadingTemplateId.value).toBeNull()
      expect(app.loadGraphData).not.toHaveBeenCalled()
      expect(useToastStore().messagesToAdd).toEqual([])
    }
  )

  it('continues graph loading when closing the selector unmounts the loader', async () => {
    mockWorkflowTemplatesStore.isLoaded = true
    const loader = useTemplateWorkflows()
    const component = apps.pop()
    if (!component) throw new Error('Missing loader component')
    vi.mocked(useDialogStore().closeDialog).mockImplementation(() =>
      component.unmount()
    )
    expect(await loader.loadWorkflowTemplate('template1', 'default')).toBe(true)
    expect(app.loadGraphData).toHaveBeenCalledOnce()
    expect(loader.loadingTemplateId.value).toBeNull()
  })

  it('does not prepare samples on Cloud or for extension templates', async () => {
    addVideoTemplate()
    const loader = useTemplateWorkflows()
    mockDistributionIsCloud.value = true
    expect(await loader.loadWorkflowTemplate('video', 'default')).toBe(true)
    mockDistributionIsCloud.value = false
    expect(await loader.loadWorkflowTemplate('video', 'extension')).toBe(true)
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(app.reloadNodeDefs).not.toHaveBeenCalled()
  })

  it.for([false, true])(
    'does not open an older template after a newer selection finishes (separate loader: %s)',
    async (separateLoader) => {
      const graph = addVideoTemplate()
      const download = deferred<Response>()
      const started = deferred<void>()
      vi.mocked(fetch).mockImplementation((url) => {
        if (String(url).startsWith('mock-internal-url'))
          return Promise.resolve(Response.json([]))
        if (String(url).endsWith('.mp4')) {
          started.resolve()
          return download.promise
        }
        return Promise.resolve(Response.json(graph))
      })
      const loader = useTemplateWorkflows()
      const onGraphLoadSettled = vi.fn()
      const first = loader.loadWorkflowTemplate('video', 'default', {
        onGraphLoadSettled
      })
      await started.promise
      const nextLoader = separateLoader ? useTemplateWorkflows() : loader
      expect(
        await nextLoader.loadWorkflowTemplate('template1', 'default')
      ).toBe(true)
      download.resolve(new Response('video'))
      expect(await first).toBe(false)
      expect(onGraphLoadSettled).not.toHaveBeenCalled()
      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      expect(
        useToastStore().messagesToAdd.filter(
          (message) => message.severity === 'error'
        )
      ).toEqual([])
    }
  )
})

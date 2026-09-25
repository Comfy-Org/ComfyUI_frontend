import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { render, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCinematicComposerDrafts } from './useCinematicComposerDrafts'
import { useCinematicShot } from './useCinematicShot'
import * as demoRun from './useCinematicDemoRun'
import {
  composerDraftKey,
  parseComposerDrafts,
  serializeComposerDrafts
} from '../lib/workshop/cinematic-studio/composer-drafts'
import type { ComposerDrafts } from '../lib/workshop/cinematic-studio/composer-drafts'
import { AUTO_DIRECTION } from '../lib/workshop/cinematic-studio/catalog'
import {
  loadReferenceBundle,
  saveReferenceBundle
} from '../lib/workshop/cinematic-studio/reference-bundles'
import type { ReferenceFile } from '../lib/workshop/cinematic-studio/reference-bundles'
import type { CinematicModel } from '../lib/workshop/cinematic-studio/models'

vi.mock(import('../lib/workshop/cinematic-studio/reference-bundles'), () => ({
  loadReferenceBundle: vi.fn(),
  saveReferenceBundle: vi.fn()
}))
beforeEach(() => {
  vi.spyOn(demoRun, 'isCinematicDemo').mockReturnValue(true)
})
const fresh = (): ComposerDrafts => ({
  version: 1,
  mode: 'image',
  image: {
    modelSlug: 'image',
    scene: '',
    direction: { ...AUTO_DIRECTION },
    enhance: true
  },
  video: {
    modelSlug: 'video',
    scene: '',
    direction: { ...AUTO_DIRECTION },
    enhance: true
  }
})
const models: readonly CinematicModel[] = [
  {
    slug: 'image',
    name: 'Image',
    provider: 'test',
    logo: '',
    seed: { step: 1 }
  },
  {
    slug: 'video',
    name: 'Video',
    provider: 'test',
    logo: '',
    mode: 'video',
    seed: { step: 1 },
    video: {
      durations: [5, 10],
      resolutions: ['720p', '1080p'],
      aspects: ['16:9'],
      defaultDuration: 5,
      defaultResolution: '720p',
      firstFrame: 'optional',
      lastFrame: true,
      generateAudio: true
    }
  }
]

function mountShot(
  choices: readonly CinematicModel[] = models,
  editing: readonly CinematicModel[] = []
) {
  let shot: ReturnType<typeof useCinematicShot> | undefined
  const view = render(
    defineComponent({
      setup() {
        shot = useCinematicShot(choices, editing)
        return () => h('div')
      }
    })
  )
  if (!shot) throw new Error('Missing shot')
  return { shot, ...view }
}

describe('composer persistence', () => {
  it('uses edit-route aspect capabilities with references and preserves editing reference order', async () => {
    localStorage.removeItem(composerDraftKey('demo'))
    const editModel = {
      ...models[0],
      slug: 'image-edit',
      seed: { minimum: 0, maximum: 100, step: 1 },
      imageAspects: ['1:1']
    }
    const { shot } = mountShot(
      [
        {
          ...models[0],
          referenceModelSlug: editModel.slug,
          imageAspects: ['3:2', '1:1']
        }
      ],
      [editModel]
    )
    const first = new File(['first'], 'first.png', { type: 'image/png' })
    const extra = new File(['extra'], 'extra.png', { type: 'image/png' })
    shot.aspect.value = '3:2'
    expect(shot.aspect.value).toBe('3:2')
    shot.cast.value = first
    expect(shot.selectedModel.value?.imageAspects).toEqual(['1:1'])
    expect(shot.aspect.value).toBe('1:1')
    await nextTick()
    shot.reviewEdit({
      modelSlug: editModel.slug,
      takes: 3,
      seed: 0,
      prompt: 'Keep the character',
      aspect: '1:1',
      sourceFile: first,
      sourceFiles: [extra],
      operation: 'edit'
    })
    expect(shot.review.value?.request.takes).toBe(3)
    expect(shot.review.value?.request.seed).toBe(0)
    expect(shot.review.value?.request.settings).toMatchObject({
      takes: 3,
      seed: 0
    })
    expect(shot.review.value?.request.references).toEqual([first, extra])
    expect(
      shot.review.value?.request.referenceFiles?.map((entry) => entry.file.name)
    ).toEqual(['first.png', 'extra.png'])
    expect(shot.review.value?.request.editing?.sourceFiles).toEqual([extra])
    expect(shot.review.value?.request.settings?.references).toEqual([
      'first.png',
      'extra.png'
    ])
  })
  it('reloads separate image references and video boundary files with source identities', async () => {
    localStorage.removeItem(composerDraftKey('demo'))
    const bundles = new Map<string, readonly ReferenceFile[]>()
    vi.mocked(saveReferenceBundle).mockImplementation(async (_scope, files) => {
      const id = (files[0].role === 'cast' ? 'a' : 'b').repeat(64)
      bundles.set(id, files)
      return id
    })
    vi.mocked(loadReferenceBundle).mockImplementation(async (_scope, id) => [
      ...(bundles.get(id) ?? [])
    ])
    const first = mountShot()
    const cast = new File(['cast'], 'cast.png', { type: 'image/png' })
    const boundary = new File(['first'], 'first.png', { type: 'image/png' })
    first.shot.cast.value = cast
    first.shot.applyTransition({
      modelSlug: 'video',
      firstFrame: boundary,
      lastFrame: boundary,
      firstSourceId: 'saved-first',
      lastSourceId: 'saved-last'
    })
    await waitFor(() =>
      expect(
        parseComposerDrafts(
          localStorage.getItem(composerDraftKey('demo')) ?? ''
        ).video.referenceBundleId
      ).toBe('b'.repeat(64))
    )
    first.unmount()
    const second = mountShot()
    await waitFor(() =>
      expect(second.shot.firstFrame.value?.name).toBe('first.png')
    )
    expect(second.shot.cast.value?.name).toBe('cast.png')
    expect(second.shot.lastFrame.value?.name).toBe('first.png')
    const restored = parseComposerDrafts(
      localStorage.getItem(composerDraftKey('demo')) ?? ''
    )
    expect(restored.video.sourceId).toBe('saved-first')
    expect(restored.video.lastSourceId).toBe('saved-last')
    vi.mocked(saveReferenceBundle).mockReset()
    vi.mocked(loadReferenceBundle).mockReset()
  })
  it('retains independent mode controls through switching and reload', async () => {
    localStorage.removeItem(composerDraftKey('demo'))
    const first = mountShot()
    first.shot.scene.value = 'Still harbor'
    first.shot.enhance.value = false
    first.shot.requestedSeed.value = 12
    first.shot.creative.value = { ...first.shot.creative.value, genre: 'noir' }
    first.shot.direction.value = { ...AUTO_DIRECTION }
    first.shot.resolution.value = '1K'
    first.shot.mode.value = 'video'
    expect(first.shot.enhance.value).toBe(true)
    expect(first.shot.requestedSeed.value).toBeUndefined()
    expect(first.shot.creative.value.genre).toBe('auto')
    first.shot.scene.value = 'Moving harbor'
    first.shot.requestedSeed.value = 34
    first.shot.duration.value = 10
    first.shot.audio.value = true
    await nextTick()
    first.unmount()
    const second = mountShot()
    expect(second.shot.mode.value).toBe('video')
    expect(second.shot.scene.value).toBe('Moving harbor')
    expect(second.shot.requestedSeed.value).toBe(34)
    expect(second.shot.duration.value).toBe(10)
    expect(second.shot.audio.value).toBe(true)
    second.shot.mode.value = 'image'
    expect(second.shot.scene.value).toBe('Still harbor')
    expect(second.shot.enhance.value).toBe(false)
    expect(second.shot.creative.value.genre).toBe('noir')
    expect(second.shot.requestedSeed.value).toBe(12)
    expect(second.shot.resolution.value).toBe('1K')
  })

  it('does not write before reference hydration or leak a delayed read into another scope', async () => {
    const scope = ref('draft-account-a')
    const state = ref(fresh())
    const files = shallowRef<
      Record<'image' | 'video', readonly ReferenceFile[]>
    >({ image: [], video: [] })
    const saved = fresh()
    saved.image.scene = 'Private'
    saved.image.referenceBundleId = 'a'.repeat(64)
    const original = serializeComposerDrafts(saved)
    localStorage.setItem(composerDraftKey(scope.value), original)
    let finish: (files: ReferenceFile[]) => void = () => {}
    vi.mocked(loadReferenceBundle).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const error = vi.fn()
    render(
      defineComponent({
        setup() {
          useCinematicComposerDrafts({
            namespace: () => scope.value,
            read: () => state.value,
            files: () => files.value,
            reset: () => {
              state.value = fresh()
              files.value = { image: [], video: [] }
            },
            apply: (value) => {
              state.value = value
            },
            applyFiles: (mode, value) => {
              files.value = { ...files.value, [mode]: value }
            },
            error
          })
          return () => h('div')
        }
      })
    )
    await nextTick()
    expect(localStorage.getItem(composerDraftKey('draft-account-a'))).toBe(
      original
    )
    scope.value = 'draft-account-b'
    await nextTick()
    finish([
      {
        role: 'cast',
        file: new File(['private'], 'private.png', { type: 'image/png' })
      }
    ])
    await nextTick()
    await nextTick()
    expect(files.value.image).toEqual([])
    expect(state.value.image.scene).toBe('')
    expect(
      localStorage.getItem(composerDraftKey('draft-account-b'))
    ).not.toContain('Private')
    expect(error).not.toHaveBeenCalled()
  })

  it('keeps a missing reference bundle receipt and warns instead of silently dropping it', async () => {
    const scope = 'draft-missing'
    const draft = fresh()
    draft.image.referenceBundleId = 'b'.repeat(64)
    draft.image.references = ['missing.png']
    localStorage.setItem(
      composerDraftKey(scope),
      serializeComposerDrafts(draft)
    )
    vi.mocked(loadReferenceBundle).mockRejectedValueOnce(new Error('Missing'))
    const state = ref(fresh())
    const error = vi.fn()
    render(
      defineComponent({
        setup() {
          useCinematicComposerDrafts({
            namespace: () => scope,
            read: () => state.value,
            files: () => ({ image: [], video: [] }),
            reset: () => {
              state.value = fresh()
            },
            apply: (value) => {
              state.value = value
            },
            applyFiles: () => {},
            error
          })
          return () => h('div')
        }
      })
    )
    await waitFor(() => expect(error).toHaveBeenCalledWith('read'))
    state.value.image.scene = 'Edited after missing file'
    await nextTick()
    const restored = parseComposerDrafts(
      localStorage.getItem(composerDraftKey(scope)) ?? ''
    )
    expect(restored.image.referenceBundleId).toBe(draft.image.referenceBundleId)
    expect(restored.image.references).toEqual(['missing.png'])
  })

  it('does not publish stale metadata after a scope change while saving reference bytes', async () => {
    const scope = ref('draft-write-a')
    const state = ref(fresh())
    const files = shallowRef<
      Record<'image' | 'video', readonly ReferenceFile[]>
    >({ image: [], video: [] })
    let finish: (id: string) => void = () => {}
    vi.mocked(saveReferenceBundle).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    render(
      defineComponent({
        setup() {
          useCinematicComposerDrafts({
            namespace: () => scope.value,
            read: () => state.value,
            files: () => files.value,
            reset: () => {
              state.value = fresh()
              files.value = { image: [], video: [] }
            },
            apply: (value) => {
              state.value = value
            },
            applyFiles: () => {},
            error: vi.fn()
          })
          return () => h('div')
        }
      })
    )
    state.value.image.scene = 'Private upload'
    files.value = {
      image: [
        { role: 'cast', file: new File(['x'], 'x.png', { type: 'image/png' }) }
      ],
      video: []
    }
    await nextTick()
    scope.value = 'draft-write-b'
    finish('c'.repeat(64))
    await nextTick()
    await nextTick()
    expect(
      localStorage.getItem(composerDraftKey('draft-write-b'))
    ).not.toContain('Private upload')
    expect(
      localStorage.getItem(composerDraftKey('draft-write-a'))
    ).not.toContain('Private upload')
  })
})

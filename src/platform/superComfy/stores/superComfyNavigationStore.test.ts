import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { useSuperComfyNavigationStore } from './superComfyNavigationStore'

const appPath = 'workflows/portrait.app.json'
const origin = { workflowPath: appPath, appNodeId: 'node-1' }

function showWorkflow(path: string) {
  useWorkflowStore().activeWorkflow = fromPartial({ path })
}

vi.mock(import('@/composables/useFeatureFlags'))

describe('useSuperComfyNavigationStore', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).superComfyEnabled = true
  })

  it.for([
    {
      name: 'shows the open layer while the flag is on',
      flag: true,
      visible: true
    },
    {
      name: 'hides the open layer once the flag is off',
      flag: false,
      visible: false
    }
  ])('$name', ({ flag, visible }) => {
    vi.mocked(useFeatureFlags().flags).superComfyEnabled = flag
    const navigation = useSuperComfyNavigationStore()

    navigation.open()

    expect(navigation.isVisible).toBe(visible)
  })

  it('opens, closes and toggles the layer', () => {
    const navigation = useSuperComfyNavigationStore()

    navigation.open()
    const afterOpen = navigation.isOpen
    navigation.toggle()
    const afterToggle = navigation.isOpen
    navigation.toggle()
    const afterSecondToggle = navigation.isOpen
    navigation.close()

    expect([
      afterOpen,
      afterToggle,
      afterSecondToggle,
      navigation.isOpen
    ]).toEqual([true, false, true, false])
  })

  it('remembers the open layer for a reload in the same tab', () => {
    useSuperComfyNavigationStore().open()

    expect(sessionStorage.getItem('Comfy.SuperComfy.open')).toBe('true')
  })

  it('reopens the layer after a reload in the same tab', () => {
    sessionStorage.setItem('Comfy.SuperComfy.open', 'true')

    expect(useSuperComfyNavigationStore().isOpen).toBe(true)
  })

  it.for([
    { name: 'the drilled app is active', active: appPath, visible: true },
    {
      name: 'another workflow is active',
      active: 'workflows/other.json',
      visible: false
    }
  ])(
    'shows the SuperComfy crumb after drilling in only while $name',
    ({ active, visible }) => {
      const navigation = useSuperComfyNavigationStore()
      navigation.open()

      navigation.markDrilledInto(origin)
      showWorkflow(active)

      expect(navigation.isOpen).toBe(false)
      expect(navigation.parentCrumbVisible).toBe(visible)
    }
  )

  it('returns to SuperComfy and forgets where it drilled in', () => {
    const navigation = useSuperComfyNavigationStore()
    navigation.markDrilledInto(origin)
    showWorkflow(appPath)

    navigation.returnToSuperComfy()

    expect(navigation.isOpen).toBe(true)
    expect(navigation.origin).toBeNull()
    expect(navigation.parentCrumbVisible).toBe(false)
  })
})

import { fromAny } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { createDefaultLight } from '@/extensions/core/lightInfo/types'
import type { LightInfoEntry } from '@/extensions/core/lightInfo/types'
import enMessages from '@/locales/en/main.json'
import type { ComfyApp } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'

import LightInfo from './LightInfo.vue'
import { useLightInfo } from './useLightInfo'

vi.mock(import('./useLightInfo'), async () => {
  const { computed, ref } = await import('vue')
  const { onTestFinished } = await import('vitest')
  const lights = ref<LightInfoEntry[]>([])
  const selectedIndex = ref(-1)
  const api = {
    initialize: vi.fn(),
    cleanup: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    setGizmosVisible: vi.fn(),
    setTransformGizmoMode: vi.fn(),
    resetViewToOutput: vi.fn(),
    setCameraLocked: vi.fn(),
    lights,
    selectedIndex,
    selectedLight: computed<LightInfoEntry | null>(
      () => lights.value[selectedIndex.value] ?? null
    ),
    selectLight: vi.fn(),
    addLight: vi.fn(),
    removeSelectedLight: vi.fn(),
    updateSelectedLight: vi.fn(),
    setSelectedLightType: vi.fn()
  }
  return {
    useLightInfo: vi.fn(() => {
      onTestFinished(() => {
        lights.value = []
        selectedIndex.value = -1
      })
      return api
    })
  }
})

vi.mock(import('@/scripts/app'), () => ({
  app: fromAny<ComfyApp, object>({})
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function lightState(lights: LightInfoEntry[] = [], selected = 0) {
  const state = useLightInfo(null)
  state.lights.value = lights
  state.selectedIndex.value = lights.length ? selected : -1
  return state
}

function renderComponent() {
  const user = userEvent.setup()
  const result = render(LightInfo, {
    props: { nodeId: toNodeId(7) },
    global: { plugins: [i18n] }
  })
  return { user, ...result }
}

async function typeInto(
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  text: string
) {
  const input = screen.getByRole('textbox', { name: field })
  await user.clear(input)
  await user.type(input, `${text}{Enter}`)
}

const spot: LightInfoEntry = {
  ...createDefaultLight('spot'),
  innerConeAngle: 30,
  outerConeAngle: 45
}

describe('LightInfo lifecycle', () => {
  it('starts the viewport on mount and cleans it up on unmount', () => {
    const state = lightState()
    const { unmount } = renderComponent()

    expect(state.initialize).toHaveBeenCalledWith(expect.any(HTMLElement))

    unmount()
    expect(state.cleanup).toHaveBeenCalledOnce()
  })

  it('invites adding a light when there are none', () => {
    lightState()
    renderComponent()

    expect(screen.getByText('Add a light to get started.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove light' })
    ).not.toBeInTheDocument()
  })
})

describe('LightInfo light list', () => {
  it('adds a directional light', async () => {
    const state = lightState()
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Add light' }))

    expect(state.addLight).toHaveBeenCalledWith('directional')
  })

  it('marks the selected light and selects another on click', async () => {
    const state = lightState([spot, createDefaultLight('point')], 0)
    const { user } = renderComponent()

    expect(
      screen.getByRole('button', { name: 'Light 01, Spot' })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Light 02, Point' }))

    expect(state.selectLight).toHaveBeenCalledWith(1)
  })

  it('removes the selected light', async () => {
    const state = lightState([spot])
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Remove light' }))

    expect(state.removeSelectedLight).toHaveBeenCalledOnce()
  })

  it('changes the selected light type', async () => {
    const state = lightState([spot])
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Point' }))

    expect(state.setSelectedLightType).toHaveBeenCalledWith('point')
  })
})

describe('LightInfo property panel', () => {
  it.for([
    {
      type: 'directional',
      fields: ['Intensity', 'Angle']
    },
    {
      type: 'point',
      fields: ['Intensity', 'Size', 'Range']
    },
    {
      type: 'spot',
      fields: ['Intensity', 'Size', 'Range', 'Inner cone', 'Outer cone']
    }
  ] as const)('shows the $type light fields', ({ type, fields }) => {
    lightState([createDefaultLight(type)])
    renderComponent()

    expect(
      screen
        .getAllByRole('textbox')
        .map((input) => input.getAttribute('aria-label'))
    ).toEqual(fields)
    expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Cast shadow' })
    ).toBeInTheDocument()
  })

  it.for([
    {
      label: 'rounds intensity to one decimal',
      light: spot,
      field: 'Intensity',
      typed: '1.26',
      patch: { intensity: 1.3 }
    },
    {
      label: 'rounds a point light size to two decimals',
      light: createDefaultLight('point'),
      field: 'Size',
      typed: '0.123',
      patch: { radius: 0.12 }
    },
    {
      label: 'rounds a sun angle to one decimal',
      light: createDefaultLight('directional'),
      field: 'Angle',
      typed: '0.26',
      patch: { radius: 0.3 }
    },
    {
      label: 'rounds cone angles to whole degrees',
      light: spot,
      field: 'Inner cone',
      typed: '12.6',
      patch: { innerConeAngle: 13 }
    },
    {
      label: 'keeps the inner cone inside the outer cone',
      light: spot,
      field: 'Inner cone',
      typed: '50',
      patch: { innerConeAngle: 45 }
    },
    {
      label: 'pulls the inner cone in with a narrower outer cone',
      light: spot,
      field: 'Outer cone',
      typed: '20',
      patch: { outerConeAngle: 20, innerConeAngle: 20 }
    },
    {
      label: 'leaves the inner cone alone with a wider outer cone',
      light: spot,
      field: 'Outer cone',
      typed: '60',
      patch: { outerConeAngle: 60, innerConeAngle: 30 }
    }
  ])('$label', async ({ light, field, typed, patch }) => {
    const state = lightState([light])
    const { user } = renderComponent()

    await typeInto(user, field, typed)

    expect(state.updateSelectedLight).toHaveBeenLastCalledWith(patch)
  })

  it('shows stored values without floating point noise', () => {
    lightState([
      { ...spot, intensity: 1.2000000000000002, radius: 0.30000000000000004 }
    ])
    renderComponent()

    expect(screen.getByRole('textbox', { name: 'Intensity' })).toHaveValue(
      '1.2'
    )
    expect(screen.getByRole('textbox', { name: 'Size' })).toHaveValue('0.3')
  })

  it('turns shadows off for the selected light', async () => {
    const state = lightState([spot])
    const { user } = renderComponent()

    await user.click(screen.getByRole('switch', { name: 'Cast shadow' }))

    expect(state.updateSelectedLight).toHaveBeenCalledWith({
      castShadow: false
    })
  })
})

describe('LightInfo toolbar', () => {
  it.for([
    {
      button: 'Hide gizmos',
      action: 'setGizmosVisible',
      value: false,
      after: 'Show gizmos'
    },
    {
      button: 'Lock camera',
      action: 'setCameraLocked',
      value: true,
      after: 'Unlock camera'
    }
  ] as const)(
    '$button toggles via $action',
    async ({ button, action, value, after }) => {
      const state = lightState([spot])
      const { user } = renderComponent()

      await user.click(screen.getByRole('button', { name: button }))

      expect(state[action]).toHaveBeenCalledWith(value)
      expect(screen.getByRole('button', { name: after })).toBeInTheDocument()
    }
  )

  it.for(['Add light', 'Output view'])(
    'names the %s button in a tooltip',
    async (button) => {
      lightState([spot])
      const { user } = renderComponent()

      await user.hover(screen.getByRole('button', { name: button }))

      expect(await screen.findByRole('tooltip')).toHaveTextContent(button)
    }
  )

  it('returns the camera to the output view', async () => {
    const state = lightState([spot])
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Output view' }))

    expect(state.resetViewToOutput).toHaveBeenCalledOnce()
  })

  it.for([
    { type: 'directional', enabled: { 'Light pos': false, Target: true } },
    { type: 'point', enabled: { 'Light pos': true, Target: false } },
    { type: 'spot', enabled: { 'Light pos': true, Target: true } }
  ] as const)(
    'offers only the transform gizmos a $type light supports',
    ({ type, enabled }) => {
      lightState([createDefaultLight(type)])
      renderComponent()

      expect({
        'Light pos': screen
          .getByRole('button', { name: 'Light pos' })
          .hasAttribute('disabled'),
        Target: screen
          .getByRole('button', { name: 'Target' })
          .hasAttribute('disabled')
      }).toEqual({
        'Light pos': !enabled['Light pos'],
        Target: !enabled.Target
      })
    }
  )

  it('shows None while the chosen gizmo does not apply and restores it after', async () => {
    const state = lightState([spot, createDefaultLight('point')], 0)
    const { user } = renderComponent()
    await user.click(screen.getByRole('button', { name: 'Target' }))
    expect(state.setTransformGizmoMode).toHaveBeenCalledWith('target')

    state.selectedIndex.value = 1
    await nextTick()
    expect(screen.getByRole('button', { name: 'Target' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    state.selectedIndex.value = 0
    await nextTick()
    expect(screen.getByRole('button', { name: 'Target' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

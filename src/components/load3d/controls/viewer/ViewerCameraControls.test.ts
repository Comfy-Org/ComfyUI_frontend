import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ViewerCameraControls from '@/components/load3d/controls/viewer/ViewerCameraControls.vue'
import type { CameraType } from '@/extensions/core/load3d/interfaces'

vi.mock('@/components/ui/select/Select.vue', async () => {
  const { provide } = await import('vue')
  return {
    default: {
      name: 'Select',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup(
        props: { modelValue: string },
        { emit }: { emit: (event: string, value: string) => void }
      ) {
        provide('selectModelValue', (): string => props.modelValue)
        provide('selectUpdate', (v: string): void =>
          emit('update:modelValue', v)
        )
      },
      template: '<div><slot /></div>'
    }
  }
})

vi.mock('@/components/ui/select/SelectContent.vue', async () => {
  const { inject, ref, onMounted } = await import('vue')
  return {
    default: {
      name: 'SelectContent',
      setup() {
        const selectModelValue = inject<() => string>('selectModelValue')
        const selectUpdate = inject<(v: string) => void>('selectUpdate')
        const el = ref<HTMLSelectElement | null>(null)
        onMounted(() => {
          if (el.value) el.value.value = selectModelValue?.() ?? ''
        })
        return {
          el,
          onChange: (e: Event) => {
            selectUpdate?.((e.target as HTMLSelectElement).value)
          }
        }
      },
      template: '<select ref="el" @change="onChange"><slot /></select>'
    }
  }
})

vi.mock('@/components/ui/select/SelectItem.vue', () => ({
  default: {
    name: 'SelectItem',
    props: ['value'],
    template: '<option :value="value"><slot /></option>'
  }
}))

vi.mock('@/components/ui/select/SelectTrigger.vue', () => ({
  default: { name: 'SelectTrigger', template: '<span />' }
}))

vi.mock('@/components/ui/select/SelectValue.vue', () => ({
  default: { name: 'SelectValue', template: '<span />' }
}))

vi.mock('@/components/ui/slider/Slider.vue', () => ({
  default: {
    name: 'UiSlider',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="range"
        role="slider"
        :value="Array.isArray(modelValue) ? modelValue[0] : modelValue"
        :min="min"
        :max="max"
        :step="step"
        @input="$emit('update:modelValue', [Number($event.target.value)])"
      />
    `
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        fov: 'FOV',
        viewer: { cameraType: 'Camera type' },
        cameraType: {
          perspective: 'Perspective',
          orthographic: 'Orthographic'
        }
      }
    }
  }
})

function renderComponent(initial: { type?: CameraType; fov?: number } = {}) {
  const cameraType = ref<CameraType>(initial.type ?? 'perspective')
  const fov = ref<number>(initial.fov ?? 75)

  const utils = render(ViewerCameraControls, {
    props: {
      cameraType: cameraType.value,
      'onUpdate:cameraType': (v: CameraType | undefined) => {
        if (v) cameraType.value = v
      },
      fov: fov.value,
      'onUpdate:fov': (v: number | undefined) => {
        if (v !== undefined) fov.value = v
      }
    },
    global: { plugins: [i18n] }
  })

  return { ...utils, cameraType, fov, user: userEvent.setup() }
}

describe('ViewerCameraControls', () => {
  it('exposes both camera types in the dropdown', () => {
    renderComponent()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.value)

    expect(options).toEqual(['perspective', 'orthographic'])
  })

  it('shows the FOV slider when the camera is perspective', () => {
    renderComponent({ type: 'perspective' })

    expect(screen.getByLabelText('FOV')).toBeInTheDocument()
  })

  it('hides the FOV slider when the camera is orthographic', () => {
    renderComponent({ type: 'orthographic' })

    expect(screen.queryByLabelText('FOV')).not.toBeInTheDocument()
  })

  it('reveals the FOV slider when the camera type prop changes back to perspective', async () => {
    const { rerender } = renderComponent({ type: 'orthographic' })
    expect(screen.queryByLabelText('FOV')).not.toBeInTheDocument()

    await rerender({ cameraType: 'perspective' })

    expect(screen.getByLabelText('FOV')).toBeInTheDocument()
  })

  it('updates fov via v-model when the slider changes', () => {
    const { fov } = renderComponent({ type: 'perspective', fov: 60 })
    const slider = screen.getByLabelText('FOV') as HTMLInputElement

    slider.value = '90'
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    expect(fov.value).toBe(90)
  })

  it('updates cameraType via v-model when the dropdown changes', async () => {
    const { user, cameraType } = renderComponent({ type: 'perspective' })

    await user.selectOptions(screen.getByRole('combobox'), 'orthographic')

    expect(cameraType.value).toBe('orthographic')
  })
})

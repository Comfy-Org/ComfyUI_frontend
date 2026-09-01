import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ModelControls from '@/components/load3d/controls/ModelControls.vue'
import type {
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        upDirection: 'Up direction',
        materialMode: 'Material mode',
        showSkeleton: 'Show skeleton',
        materialModes: {
          original: 'Original',
          normal: 'Normal',
          wireframe: 'Wireframe',
          pointCloud: 'Point cloud',
          depth: 'Depth'
        }
      }
    }
  }
})

type RenderOpts = {
  upDirection?: UpDirection
  materialMode?: MaterialMode
  showSkeleton?: boolean
  materialModes?: readonly MaterialMode[]
  hasSkeleton?: boolean
}

function renderComponent(opts: RenderOpts = {}) {
  const upDirection = ref<UpDirection>(opts.upDirection ?? 'original')
  const materialMode = ref<MaterialMode>(opts.materialMode ?? 'original')
  const showSkeleton = ref<boolean>(opts.showSkeleton ?? false)

  const utils = render(ModelControls, {
    props: {
      upDirection: upDirection.value,
      'onUpdate:upDirection': (v: UpDirection | undefined) => {
        if (v) upDirection.value = v
      },
      materialMode: materialMode.value,
      'onUpdate:materialMode': (v: MaterialMode | undefined) => {
        if (v) materialMode.value = v
      },
      showSkeleton: showSkeleton.value,
      'onUpdate:showSkeleton': (v: boolean | undefined) => {
        if (v !== undefined) showSkeleton.value = v
      },
      materialModes: opts.materialModes ?? ['original', 'normal', 'wireframe'],
      hasSkeleton: opts.hasSkeleton ?? false
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return {
    ...utils,
    upDirection,
    materialMode,
    showSkeleton,
    user: userEvent.setup()
  }
}

describe('ModelControls', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('up direction', () => {
    it('renders the up-direction trigger and opens the popup with all 7 directions', async () => {
      const { user } = renderComponent()
      await user.click(screen.getByRole('button', { name: 'Up direction' }))

      for (const label of ['ORIGINAL', '-X', '+X', '-Y', '+Y', '-Z', '+Z']) {
        expect(screen.getByRole('button', { name: label })).toBeVisible()
      }
    })

    it('updates upDirection v-model when a direction is selected', async () => {
      const { user, upDirection } = renderComponent()
      await user.click(screen.getByRole('button', { name: 'Up direction' }))
      await user.click(screen.getByRole('button', { name: '+X' }))

      expect(upDirection.value).toBe('+x')
    })
  })

  describe('material mode', () => {
    it('renders the material-mode trigger when materialModes is non-empty', () => {
      renderComponent({ materialModes: ['original', 'normal'] })

      expect(
        screen.getByRole('button', { name: 'Material mode' })
      ).toBeInTheDocument()
    })

    it('hides the material-mode trigger when materialModes is empty', () => {
      renderComponent({ materialModes: [] })

      expect(
        screen.queryByRole('button', { name: 'Material mode' })
      ).not.toBeInTheDocument()
    })

    it('renders one popup option per entry in materialModes', async () => {
      const { user } = renderComponent({
        materialModes: ['original', 'pointCloud', 'normal', 'wireframe']
      })
      await user.click(screen.getByRole('button', { name: 'Material mode' }))

      expect(screen.getByRole('button', { name: 'Original' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Point cloud' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Normal' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Wireframe' })).toBeVisible()
    })

    it('updates materialMode v-model when a mode is selected', async () => {
      const { user, materialMode } = renderComponent({
        materialModes: ['original', 'normal']
      })
      await user.click(screen.getByRole('button', { name: 'Material mode' }))
      await user.click(screen.getByRole('button', { name: 'Normal' }))

      expect(materialMode.value).toBe('normal')
    })
  })

  describe('skeleton', () => {
    it('hides the skeleton button when hasSkeleton is false', () => {
      renderComponent({ hasSkeleton: false })

      expect(
        screen.queryByRole('button', { name: 'Show skeleton' })
      ).not.toBeInTheDocument()
    })

    it('renders the skeleton button when hasSkeleton is true', () => {
      renderComponent({ hasSkeleton: true })

      expect(
        screen.getByRole('button', { name: 'Show skeleton' })
      ).toBeInTheDocument()
    })

    it('flips showSkeleton v-model when the skeleton button is clicked', async () => {
      const { user, showSkeleton } = renderComponent({
        hasSkeleton: true,
        showSkeleton: false
      })
      await user.click(screen.getByRole('button', { name: 'Show skeleton' }))

      expect(showSkeleton.value).toBe(true)
    })
  })

  describe('popup mutual exclusion', () => {
    it('closes the up-direction popup when the material-mode trigger is clicked', async () => {
      const { user } = renderComponent()

      await user.click(screen.getByRole('button', { name: 'Up direction' }))
      expect(screen.getByRole('button', { name: 'ORIGINAL' })).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'Material mode' }))

      expect(
        screen.queryByRole('button', { name: 'ORIGINAL' })
      ).not.toBeInTheDocument()
    })
  })
})

import { composeStories, setProjectAnnotations } from '@storybook/vue3'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import PrimeDialog from 'primevue/dialog'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { App, Component } from 'vue'
import { defineComponent, ref } from 'vue'

import * as moreButtonStories from '@/components/button/MoreButton.stories'
import * as jobDetailsPopoverStories from '@/components/queue/job/JobDetailsPopover.stories'
import * as colorPickerStories from '@/components/ui/color-picker/ColorPicker.stories'
import * as dialogStories from '@/components/ui/dialog/Dialog.stories'
import * as baseModalLayoutStories from '@/components/widget/layout/BaseModalLayout.stories'
import * as assetBrowserModalStories from '@/platform/assets/components/AssetBrowserModal.stories'
import * as mediaLightboxStories from '@/platform/assets/components/MediaLightbox.stories'
import * as assetBrowserDialogStories from '@/platform/assets/composables/useAssetBrowserDialog.stories'
import { ComfyDialog } from '@/scripts/ui/dialog'
import { isModalOpen } from '@/utils/modalUtil'

import * as storybookPreview from '../../.storybook/preview'

/**
 * `isModalOpen` recognises overlays by their rendered markup, so hand-written
 * DOM fixtures only ever test it against what their author believed the
 * components emit. #15639 is what that gap costs: a PrimeVue `Popover`
 * announces `aria-modal="true"`, nobody knew, and Ctrl+S stopped saving
 * whenever one was on screen.
 *
 * These cases mount the real components and pin whether each must suppress the
 * app's global keybindings. `modalUtil.test.ts` covers the predicate's logic;
 * this file covers its premises.
 */

const NO_MANAGED_DIALOGS = 0

/**
 * The overlay vocabularies in use, keyed by how a component reaches for one.
 * Every overlay in the app is one of these composed into something bigger, and
 * the gate reads attributes each library emits unconditionally, so classifying
 * the vocabulary classifies every component built on it - which `MoreButton`, a
 * PrimeVue `Popover` one layer down, is here to demonstrate. That transitivity
 * is why the gate must never key on anything a call site can switch off, as
 * `.p-popover` was until `unstyled` call sites proved otherwise.
 *
 * Sibling entries from the same libraries are listed even when nothing uses
 * them yet, so adopting one trips the coverage guard below. A whole new overlay
 * library would not: that is the limit of a source scan, and it is a far more
 * visible event than reusing a vocabulary the app already ships.
 */
const OVERLAY_VOCABULARIES = {
  'PrimeVue Popover': /from 'primevue\/popover'/,
  'PrimeVue Dialog': /from 'primevue\/dialog'/,
  'PrimeVue Drawer': /from 'primevue\/drawer'/,
  'PrimeVue ConfirmDialog': /from 'primevue\/confirmdialog'/,
  'Reka Dialog': /\bDialogRoot\b|\bDialogContent\b|components\/ui\/dialog/,
  'Reka Popover': /\bPopoverRoot\b|\bPopoverContent\b|components\/ui\/popover/,
  'Reka AlertDialog': /\bAlertDialogRoot\b|\bAlertDialogContent\b/,
  'hand-written ARIA modal': /aria-modal/,
  'native dialog': /<dialog[\s>]|createElement\('dialog'\)|showModal\(/,
  'legacy ComfyDialog': /comfy-modal/
} as const

type OverlayVocabulary = keyof typeof OVERLAY_VOCABULARIES

type User = ReturnType<typeof userEvent.setup>

interface OverlayCase {
  label: string
  /** Vocabularies this case puts through the gate, if any. */
  covers?: OverlayVocabulary[]
  /** Puts the overlay on screen the way a user would. */
  open: (user: User) => Promise<void>
  /**
   * Something `open` must have put on screen. Without it a surface that
   * silently stopped rendering would still satisfy every `blocksShortcuts:
   * false` case, which is most of them.
   */
  onScreen: () => HTMLElement
  /** Whether the surface must suppress the app's global keybindings. */
  blocksShortcuts: boolean
}

/**
 * `.storybook/preview.ts` registers pinia, i18n and PrimeVue through
 * Storybook's `setup()`, which stores them on this global and replays them
 * only from Storybook's own renderer. Pinned to `@storybook/vue3` 10.x; a major
 * upgrade should re-check the name, because a miss here degrades to components
 * failing to resolve rather than to an error.
 */
const storybookAppSetup = {
  install(app: App) {
    const setupFunctions = (
      globalThis as typeof globalThis & {
        PLUGINS_SETUP_FUNCTIONS?: Set<(app: App) => void>
      }
    ).PLUGINS_SETUP_FUNCTIONS
    for (const setupFunction of setupFunctions ?? []) setupFunction(app)
  }
}

const projectAnnotations = setProjectAnnotations([storybookPreview])

beforeAll(projectAnnotations.beforeAll)

function mount(component: Component): void {
  render(component, { global: { plugins: [storybookAppSetup] } })
}

const PrimeVueDialogHost = defineComponent({
  components: { PrimeDialog },
  setup: () => ({ visible: ref(false) }),
  template: `
    <button @click="visible = true">Open settings</button>
    <PrimeDialog v-model:visible="visible" modal header="Settings">
      <p>Settings body</p>
    </PrimeDialog>
  `
})

/** Overlays reached through a story, so the story doubles as the fixture. */
const storyCases: OverlayCase[] = [
  {
    // A PrimeVue Popover declares aria-modal="true" while being a
    // non-blocking hover preview, which is the regression reported as #15639.
    label: 'the MoreButton menu',
    covers: ['PrimeVue Popover'],
    open: async (user) => {
      mount(composeStories(moreButtonStories).Basic)
      await user.click(screen.getByRole('button'))
    },
    onScreen: () => screen.getByRole('button', { name: 'Profile' }),
    blocksShortcuts: false
  },
  {
    label: 'a Reka Dialog',
    covers: ['Reka Dialog'],
    open: async (user) => {
      mount(composeStories(dialogStories).Default)
      await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    },
    onScreen: () => screen.getByText('Are you sure?'),
    blocksShortcuts: true
  },
  {
    label: 'the colour picker',
    covers: ['Reka Popover'],
    open: async (user) => {
      mount(composeStories(colorPickerStories).Default)
      await user.click(screen.getByRole('button', { expanded: false }))
    },
    onScreen: () => screen.getByText('Hex'),
    blocksShortcuts: false
  },
  {
    label: 'the media lightbox',
    covers: ['hand-written ARIA modal'],
    open: async (user) => {
      mount(composeStories(mediaLightboxStories).SingleImage)
      await user.click(screen.getByRole('button', { name: 'Open lightbox' }))
    },
    onScreen: () => screen.getByRole('dialog', { name: 'Gallery' }),
    blocksShortcuts: true
  },
  {
    label: 'the job details panel',
    open: async () => {
      mount(composeStories(jobDetailsPopoverStories).Queued)
    },
    onScreen: () => screen.getByText('Job Details'),
    blocksShortcuts: false
  },
  {
    label: 'a bare BaseModalLayout',
    open: async () => {
      mount(composeStories(baseModalLayoutStories).Default)
    },
    onScreen: () => screen.getByText('Installed'),
    blocksShortcuts: false
  },
  {
    label: 'a bare AssetBrowserModal',
    open: async () => {
      mount(composeStories(assetBrowserModalStories).Default)
    },
    onScreen: () => screen.getByLabelText('Search models'),
    blocksShortcuts: false
  },
  {
    // The story hand-rolls the scrim; in the app this modal is opened through
    // the managed dialog stack, which gates on its own count.
    label: 'the asset browser behind its own scrim',
    open: async (user) => {
      mount(composeStories(assetBrowserDialogStories).Demo)
      await user.click(
        screen.getByRole('button', { name: 'Browse Checkpoints' })
      )
    },
    onScreen: () => screen.getByLabelText('Search models'),
    blocksShortcuts: false
  }
]

/** Overlays no story reaches, mounted directly. */
const unstoriedCases: OverlayCase[] = [
  {
    label: 'a PrimeVue Dialog',
    covers: ['PrimeVue Dialog'],
    open: async (user) => {
      mount(PrimeVueDialogHost)
      await user.click(screen.getByRole('button', { name: 'Open settings' }))
    },
    onScreen: () => screen.getByText('Settings body'),
    blocksShortcuts: true
  },
  {
    label: 'a native dialog',
    covers: ['native dialog'],
    open: async () => {
      const dialog = document.createElement('dialog')
      dialog.textContent = 'Native dialog'
      document.body.appendChild(dialog).showModal()
    },
    onScreen: () => screen.getByText('Native dialog'),
    blocksShortcuts: true
  },
  {
    label: 'an open ComfyDialog',
    covers: ['legacy ComfyDialog'],
    open: async () => {
      new ComfyDialog().show('Something went wrong')
    },
    onScreen: () => screen.getByText('Something went wrong'),
    blocksShortcuts: true
  },
  {
    label: 'a closed ComfyDialog',
    covers: ['legacy ComfyDialog'],
    open: async () => {
      const dialog = new ComfyDialog()
      dialog.show('Something went wrong')
      dialog.close()
    },
    onScreen: () => screen.getByText('Something went wrong'),
    blocksShortcuts: false
  }
]

const overlayCases = [...storyCases, ...unstoriedCases]

describe('overlay surfaces', () => {
  overlayCases.forEach(({ label, open, onScreen, blocksShortcuts }) => {
    const outcome = blocksShortcuts ? 'suppresses' : 'passes through'

    it(`${label} ${outcome} global shortcuts`, async () => {
      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(false)

      await open(userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))

      expect(onScreen()).toBeInTheDocument()
      expect(isModalOpen(NO_MANAGED_DIALOGS)).toBe(blocksShortcuts)
    })
  })
})

describe('overlay coverage', () => {
  const SRC_ROOT = join(import.meta.dirname, '..')

  /** The gate's own selector strings are not markup the app renders. */
  const GATE_SOURCE = join('utils', 'modalUtil.ts')

  function vocabulariesUsedInSource(): OverlayVocabulary[] {
    const sources = readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' })
      .filter(
        (file) =>
          /\.(vue|tsx?)$/.test(file) &&
          !/\.(test|spec)\.tsx?$/.test(file) &&
          file !== GATE_SOURCE
      )
      .map((file) => readFileSync(join(SRC_ROOT, file), 'utf8'))

    return Object.entries(OVERLAY_VOCABULARIES)
      .filter(([, marker]) => sources.some((source) => marker.test(source)))
      .map(([vocabulary]) => vocabulary as OverlayVocabulary)
  }

  it('classifies every overlay vocabulary the app renders', () => {
    const classified = new Set(
      overlayCases.flatMap(({ covers }) => covers ?? [])
    )

    const unclassified = vocabulariesUsedInSource()
      .filter((vocabulary) => !classified.has(vocabulary))
      .map((vocabulary) => `${vocabulary} - add a case to overlayCases`)

    expect(unclassified).toEqual([])
  })
})

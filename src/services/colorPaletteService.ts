import { toRaw } from 'vue'
import { fromZodError } from 'zod-validation-error'

import {
  CORE_COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'
import { downloadBlob } from '@/base/common/downloadUtil'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  comfyBaseSchema,
  paletteSchema
} from '@comfyorg/settings-core/colorPaletteSchema'
import type {
  ColorPalettes,
  Colors,
  Palette
} from '@comfyorg/settings-core/colorPaletteSchema'
import { useApp } from '@/scripts/appInstance'
import { applyPaletteTheme, isCorePaletteId } from '@/utils/colorPaletteTheme'
import { uploadFile } from '@/scripts/utils'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const THEME_ALIASED_LEGACY_KEYS: ReadonlySet<string> = new Set([
  'fg-color',
  'bg-color',
  'comfy-menu-bg',
  'comfy-menu-secondary-bg',
  'descrip-text',
  'drag-text',
  'error-text',
  'tr-even-bg-color',
  'tr-odd-bg-color',
  'content-bg',
  'content-fg',
  'content-hover-bg',
  'content-hover-fg'
])

const LEGACY_PALETTE_KEYS = comfyBaseSchema
  .keyof()
  .options.filter((key) => key !== 'bg-img')

let latestPaletteSwitch = 0

function availableCustomPaletteId(id: string, palettes: ColorPalettes) {
  let candidate = `${id}-custom`
  let suffix = 2
  while (
    Object.hasOwn(palettes, candidate) ||
    Object.hasOwn(CORE_COLOR_PALETTES, candidate)
  ) {
    candidate = `${id}-custom-${suffix++}`
  }
  return candidate
}

export const useColorPaletteService = () => {
  const colorPaletteStore = useColorPaletteStore()
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()
  const {
    toastErrorHandler,
    wrapWithErrorHandling,
    wrapWithErrorHandlingAsync
  } = useErrorHandling()

  const validateColorPalette = (data: unknown): Palette => {
    const result = paletteSchema.safeParse(data)
    if (result.success) return result.data

    throw fromZodError(result.error)
  }

  const persistCustomColorPalettes = async () => {
    await settingStore.set(
      'Comfy.CustomColorPalettes',
      colorPaletteStore.customPalettes
    )
  }

  async function loadCustomColorPalettes() {
    const palettes = settingStore.exists('Comfy.CustomColorPalettes')
      ? settingStore.get('Comfy.CustomColorPalettes')
      : {}
    const conflicts = Object.keys(palettes).filter((id) =>
      Object.hasOwn(CORE_COLOR_PALETTES, id)
    )
    const migrated = { ...palettes }
    const previousId = settingStore.exists('Comfy.ColorPalette')
      ? settingStore.get('Comfy.ColorPalette')
      : DEFAULT_COLOR_PALETTE.id
    let activeId = previousId
    for (const id of conflicts) {
      const newId = availableCustomPaletteId(id, migrated)
      migrated[newId] = { ...migrated[id], id: newId }
      delete migrated[id]
      if (activeId === id) activeId = newId
    }
    colorPaletteStore.customPalettes = migrated
    if (!conflicts.length) return

    await settingStore.setMany({
      'Comfy.CustomColorPalettes': migrated,
      ...(activeId !== previousId ? { 'Comfy.ColorPalette': activeId } : {})
    })
  }

  const deleteCustomColorPalette = async (colorPaletteId: string) => {
    colorPaletteStore.deleteCustomPalette(colorPaletteId)
    await persistCustomColorPalettes()
  }

  const addCustomColorPalette = async (colorPalette: Palette) => {
    validateColorPalette(colorPalette)
    colorPaletteStore.addCustomPalette(colorPalette)
    await persistCustomColorPalettes()
  }

  const loadLinkColorPalette = (linkColorPalette: Colors['node_slot']) => {
    const types = Object.fromEntries(
      Array.from(nodeDefStore.nodeDataTypes).map((type) => [type, ''])
    )
    Object.assign(
      useApp().canvas.default_connection_color_byType,
      types,
      linkColorPalette
    )
    Object.assign(LGraphCanvas.link_type_colors, types, linkColorPalette)
  }

  function loadLinkColorPaletteForVueNodes(
    linkColorPalette: Colors['node_slot']
  ) {
    const rootStyle = document.documentElement.style

    for (const dataType of nodeDefStore.nodeDataTypes) {
      const cssVar = `color-datatype-${dataType}`

      const valueMaybe = linkColorPalette[dataType as keyof Colors['node_slot']]
      if (valueMaybe) {
        rootStyle.setProperty(`--${cssVar}`, valueMaybe)
      } else {
        rootStyle.removeProperty(`--${cssVar}`)
      }
    }
  }

  const loadLiteGraphColorPalette = (palette: Colors['litegraph_base']) => {
    useApp().canvas.node_title_color = palette.NODE_TITLE_COLOR
    useApp().canvas.default_link_color = palette.LINK_COLOR
    const backgroundImage = settingStore.get('Comfy.Canvas.BackgroundImage')
    if (backgroundImage) {
      useApp().canvas.clear_background_color = 'transparent'
    } else {
      useApp().canvas.background_image = palette.BACKGROUND_IMAGE
      useApp().canvas.clear_background_color = palette.CLEAR_BACKGROUND_COLOR
    }
    useApp().canvas._pattern = undefined

    if (typeof palette.NODE_DEFAULT_SHAPE === 'string')
      console.warn(
        `litegraph_base.NODE_DEFAULT_SHAPE only accepts [${[
          LiteGraph.BOX_SHAPE,
          LiteGraph.ROUND_SHAPE,
          LiteGraph.CARD_SHAPE
        ].join(', ')}] but got ${palette.NODE_DEFAULT_SHAPE}`
      )

    const default_shape =
      typeof palette.NODE_DEFAULT_SHAPE === 'string'
        ? LiteGraph.ROUND_SHAPE
        : palette.NODE_DEFAULT_SHAPE
    const sanitizedPalette: Partial<typeof LiteGraph> = {
      ...palette,
      NODE_DEFAULT_SHAPE: default_shape
    }

    Object.assign(LiteGraph, sanitizedPalette)
  }

  const loadComfyColorPalette = (
    comfyColorPalette: Colors['comfy_base'],
    themeAliasesLegacyColors: boolean
  ) => {
    const rootStyle = document.documentElement.style
    for (const key of LEGACY_PALETTE_KEYS) {
      const value = comfyColorPalette[key]
      if (
        value === undefined ||
        (themeAliasesLegacyColors && THEME_ALIASED_LEGACY_KEYS.has(key))
      ) {
        rootStyle.removeProperty('--' + key)
      } else {
        rootStyle.setProperty('--' + key, value)
      }
    }

    const backgroundImage = settingStore.get('Comfy.Canvas.BackgroundImage')
    if (backgroundImage) {
      rootStyle.setProperty('--bg-img', `url('${backgroundImage}')`)
    } else {
      rootStyle.removeProperty('--bg-img')
    }
  }

  const afterNextFrame = (callback: () => void) =>
    requestAnimationFrame(() => requestAnimationFrame(callback))

  const persistSplashColors = () => {
    try {
      const body = getComputedStyle(document.body)
      localStorage.setItem('comfy-splash-bg', body.backgroundColor)
      localStorage.setItem('comfy-splash-fg', body.color)
    } catch (_) {
      return
    }
  }

  const loadColorPalette = async (colorPaletteId: string) => {
    const colorPalette = colorPaletteStore.palettesLookup[colorPaletteId]
    if (!colorPalette) {
      toastErrorHandler(new Error(`Color palette ${colorPaletteId} not found`))
      return
    }

    const completedPalette = colorPaletteStore.completePalette(colorPalette)
    const root = document.documentElement
    const paletteSwitch = ++latestPaletteSwitch
    root.dataset.paletteSwitching = ''
    try {
      loadLinkColorPalette(completedPalette.colors.node_slot)
      loadLiteGraphColorPalette(completedPalette.colors.litegraph_base)
      applyPaletteTheme(root.style, completedPalette)
      loadLinkColorPaletteForVueNodes(completedPalette.colors.node_slot)
      loadComfyColorPalette(
        completedPalette.colors.comfy_base,
        isCorePaletteId(completedPalette.id)
      )
      useApp().canvas.setDirty(true, true)

      colorPaletteStore.activePaletteId = colorPaletteId
    } finally {
      afterNextFrame(() => {
        if (paletteSwitch !== latestPaletteSwitch) return
        delete root.dataset.paletteSwitching
        persistSplashColors()
      })
    }
  }

  const exportColorPalette = (colorPaletteId: string) => {
    const colorPalette = colorPaletteStore.palettesLookup[colorPaletteId]
    if (!colorPalette) {
      toastErrorHandler(new Error(`Color palette ${colorPaletteId} not found`))
      return
    }
    downloadBlob(
      colorPalette.id + '.json',
      new Blob([JSON.stringify(toRaw(colorPalette), null, 2)], {
        type: 'application/json'
      })
    )
  }

  const importColorPalette = async () => {
    const file = await uploadFile('application/json')
    const text = await file.text()
    const palette = JSON.parse(text)
    await addCustomColorPalette(palette)
    return palette
  }

  return {
    getActiveColorPalette: () => colorPaletteStore.completedActivePalette,
    addCustomColorPalette: wrapWithErrorHandlingAsync(addCustomColorPalette),
    deleteCustomColorPalette: wrapWithErrorHandlingAsync(
      deleteCustomColorPalette
    ),
    loadColorPalette: wrapWithErrorHandlingAsync(loadColorPalette),
    loadCustomColorPalettes: wrapWithErrorHandlingAsync(
      loadCustomColorPalettes
    ),
    exportColorPalette: wrapWithErrorHandling(exportColorPalette),
    importColorPalette: wrapWithErrorHandlingAsync(importColorPalette)
  }
}

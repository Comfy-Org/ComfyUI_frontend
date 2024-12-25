import { useSettingStore } from '@/stores/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useErrorHandling } from '@/hooks/errorHooks'
import { paletteSchema, type Palette } from '@/types/colorPaletteTypes'
import { fromZodError } from 'zod-validation-error'
import { LGraphCanvas } from '@comfyorg/litegraph'
import { LiteGraph } from '@comfyorg/litegraph'
import { DEFAULT_COLOR_PALETTE } from '@/constants/coreColorPalettes'
import { downloadBlob, uploadFile } from '@/scripts/utils'
import { toRaw } from 'vue'

export const useColorPaletteService = () => {
  const colorPaletteStore = useColorPaletteStore()
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()
  const { wrapWithErrorHandling, wrapWithErrorHandlingAsync } =
    useErrorHandling()

  function validateColorPalette(data: unknown): Palette {
    const result = paletteSchema.safeParse(data)
    if (result.success) return result.data

    const error = fromZodError(result.error)
    throw new Error(`Invalid color palette against zod schema:\n${error}`)
  }

  const persistCustomColorPalettes = () => {
    settingStore.set(
      'Comfy.CustomColorPalettes',
      colorPaletteStore.customPalettes
    )
  }

  const deleteCustomColorPalette = (colorPaletteId: string) => {
    colorPaletteStore.deleteCustomPalette(colorPaletteId)
    persistCustomColorPalettes()
  }

  const addCustomColorPalette = (colorPalette: Palette) => {
    validateColorPalette(colorPalette)
    colorPaletteStore.addCustomPalette(colorPalette)
    persistCustomColorPalettes()
  }

  /** Sets the colors of node slots and links */
  const loadLinkColorPalette = (
    linkColorPalette: Palette['colors']['node_slot']
  ) => {
    const types = Object.fromEntries(
      Array.from(nodeDefStore.nodeDataTypes).map((type) => [type, ''])
    )
    Object.assign(app.canvas.default_connection_color_byType, {
      ...types,
      ...linkColorPalette
    })
    Object.assign(LGraphCanvas.link_type_colors, {
      ...types,
      ...linkColorPalette
    })
  }

  const loadLiteGraphColorPalette = (
    liteGraphColorPalette: Palette['colors']['litegraph_base']
  ) => {
    // Fill in missing colors with defaults
    const palette = Object.assign(
      {},
      DEFAULT_COLOR_PALETTE.colors.litegraph_base,
      liteGraphColorPalette
    )

    // Sets special case colors
    app.bypassBgColor = palette.NODE_BYPASS_BGCOLOR

    // Sets the colors of the LiteGraph objects
    app.canvas.node_title_color = palette.NODE_TITLE_COLOR
    app.canvas.default_link_color = palette.LINK_COLOR
    app.canvas.background_image = palette.BACKGROUND_IMAGE
    app.canvas.clear_background_color = palette.CLEAR_BACKGROUND_COLOR
    app.canvas._pattern = undefined

    for (const [key, value] of Object.entries(palette)) {
      if (Object.prototype.hasOwnProperty.call(LiteGraph, key)) {
        if (key === 'NODE_DEFAULT_SHAPE' && typeof value === 'string') {
          console.warn(
            `litegraph_base.NODE_DEFAULT_SHAPE only accepts [${[
              LiteGraph.BOX_SHAPE,
              LiteGraph.ROUND_SHAPE,
              LiteGraph.CARD_SHAPE
            ].join(', ')}] but got ${value}`
          )
          LiteGraph.NODE_DEFAULT_SHAPE = LiteGraph.ROUND_SHAPE
        } else {
          ;(LiteGraph as any)[key] = value
        }
      }
    }
  }

  const loadComfyColorPalette = (
    comfyColorPalette: Palette['colors']['comfy_base']
  ) => {
    if (comfyColorPalette) {
      const rootStyle = document.documentElement.style
      for (const [key, value] of Object.entries(comfyColorPalette)) {
        rootStyle.setProperty('--' + key, value)
      }
    }
  }

  const loadColorPalette = async (colorPaletteId: string) => {
    const colorPalette = colorPaletteStore.palettesLookup[colorPaletteId]
    if (!colorPalette) {
      throw new Error(`Color palette ${colorPaletteId} not found`)
    }

    loadLinkColorPalette(colorPalette.colors.node_slot)
    loadLiteGraphColorPalette(colorPalette.colors.litegraph_base)
    loadComfyColorPalette(colorPalette.colors.comfy_base)
    app.canvas.setDirty(true, true)

    colorPaletteStore.activePaletteId = colorPaletteId
    settingStore.set('Comfy.ColorPalette', colorPaletteId)
  }

  const exportColorPalette = (colorPaletteId: string) => {
    const colorPalette = colorPaletteStore.palettesLookup[colorPaletteId]
    if (!colorPalette) {
      throw new Error(`Color palette ${colorPaletteId} not found`)
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
    const data = JSON.parse(text)
    addCustomColorPalette(data)
  }

  return {
    addCustomColorPalette: wrapWithErrorHandling(addCustomColorPalette),
    deleteCustomColorPalette: wrapWithErrorHandling(deleteCustomColorPalette),
    loadColorPalette: wrapWithErrorHandling(loadColorPalette),
    exportColorPalette: wrapWithErrorHandling(exportColorPalette),
    importColorPalette: wrapWithErrorHandlingAsync(importColorPalette)
  }
}

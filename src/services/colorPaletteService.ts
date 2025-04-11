import { LGraphCanvas } from '@comfyorg/litegraph'
import { LiteGraph } from '@comfyorg/litegraph'
import { toRaw } from 'vue'
import { fromZodError } from 'zod-validation-error'

import { useErrorHandling } from '@/composables/useErrorHandling'
import {
  Colors,
  type Palette,
  paletteSchema
} from '@/schemas/colorPaletteSchema'
import { app } from '@/scripts/app'
import { downloadBlob, uploadFile } from '@/scripts/utils'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

export const useColorPaletteService = () => {
  const colorPaletteStore = useColorPaletteStore()
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()
  const { wrapWithErrorHandling, wrapWithErrorHandlingAsync } =
    useErrorHandling()

  /**
   * Validates the palette against the zod schema.
   *
   * @param data - The palette to validate.
   * @returns The validated palette.
   */
  const validateColorPalette = (data: unknown): Palette => {
    const result = paletteSchema.safeParse(data)
    if (result.success) return result.data

    const error = fromZodError(result.error)
    throw new Error(`Invalid color palette against zod schema:\n${error}`)
  }

  const persistCustomColorPalettes = async () => {
    await settingStore.set(
      'Comfy.CustomColorPalettes',
      colorPaletteStore.customPalettes
    )
  }

  /**
   * Deletes a custom color palette.
   *
   * @param colorPaletteId - The ID of the color palette to delete.
   */
  const deleteCustomColorPalette = async (colorPaletteId: string) => {
    colorPaletteStore.deleteCustomPalette(colorPaletteId)
    await persistCustomColorPalettes()
  }

  /**
   * Adds a custom color palette.
   *
   * @param colorPalette - The palette to add.
   */
  const addCustomColorPalette = async (colorPalette: Palette) => {
    validateColorPalette(colorPalette)
    colorPaletteStore.addCustomPalette(colorPalette)
    await persistCustomColorPalettes()
  }

  /**
   * Sets the colors of node slots and links.
   *
   * @param linkColorPalette - The palette to set.
   */
  const loadLinkColorPalette = (linkColorPalette: Colors['node_slot']) => {
    const types = Object.fromEntries(
      Array.from(nodeDefStore.nodeDataTypes).map((type) => [type, ''])
    )
    Object.assign(
      app.canvas.default_connection_color_byType,
      types,
      linkColorPalette
    )
    Object.assign(LGraphCanvas.link_type_colors, types, linkColorPalette)
  }

  /**
   * Loads the LiteGraph color palette.
   *
   * @param liteGraphColorPalette - The palette to set.
   */
  const loadLiteGraphColorPalette = (palette: Colors['litegraph_base']) => {
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

  /**
   * Loads the Comfy color palette.
   *
   * @param comfyColorPalette - The palette to set.
   */
  const loadComfyColorPalette = (comfyColorPalette: Colors['comfy_base']) => {
    if (comfyColorPalette) {
      const rootStyle = document.documentElement.style
      for (const [key, value] of Object.entries(comfyColorPalette)) {
        rootStyle.setProperty('--' + key, value)
      }
    }
  }

  /**
   * Loads the color palette.
   *
   * @param colorPaletteId - The ID of the color palette to load.
   */
  const loadColorPalette = async (colorPaletteId: string) => {
    const colorPalette = colorPaletteStore.palettesLookup[colorPaletteId]
    if (!colorPalette) {
      throw new Error(`Color palette ${colorPaletteId} not found`)
    }

    const completedPalette = colorPaletteStore.completePalette(colorPalette)
    loadLinkColorPalette(completedPalette.colors.node_slot)
    loadLiteGraphColorPalette(completedPalette.colors.litegraph_base)
    loadComfyColorPalette(completedPalette.colors.comfy_base)
    app.canvas.setDirty(true, true)

    colorPaletteStore.activePaletteId = colorPaletteId
  }

  /**
   * Exports a color palette.
   *
   * @param colorPaletteId - The ID of the color palette to export.
   */
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

  /**
   * Imports a color palette.
   *
   * @returns The imported palette.
   */
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
    exportColorPalette: wrapWithErrorHandling(exportColorPalette),
    importColorPalette: wrapWithErrorHandlingAsync(importColorPalette)
  }
}

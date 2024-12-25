import { useSettingStore } from '@/stores/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useErrorHandling } from '@/hooks/errorHooks'
import { paletteSchema, type Palette } from '@/types/colorPaletteTypes'
import { fromZodError } from 'zod-validation-error'
import { LGraphCanvas } from '@comfyorg/litegraph'
import { LiteGraph } from '@comfyorg/litegraph'

export const useColorPaletteService = () => {
  const colorPaletteStore = useColorPaletteStore()
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()
  const { wrapWithErrorHandling } = useErrorHandling()

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
    // Sets special case colors
    if (liteGraphColorPalette.NODE_BYPASS_BGCOLOR) {
      app.bypassBgColor = liteGraphColorPalette.NODE_BYPASS_BGCOLOR
    }
    // Sets the colors of the LiteGraph objects
    if (liteGraphColorPalette.NODE_TITLE_COLOR) {
      app.canvas.node_title_color = liteGraphColorPalette.NODE_TITLE_COLOR
    }
    if (liteGraphColorPalette.LINK_COLOR) {
      app.canvas.default_link_color = liteGraphColorPalette.LINK_COLOR
    }

    for (const [key, value] of Object.entries(liteGraphColorPalette)) {
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
  }

  return {
    addCustomColorPalette: wrapWithErrorHandling(addCustomColorPalette),
    deleteCustomColorPalette: wrapWithErrorHandling(deleteCustomColorPalette),
    loadColorPalette: wrapWithErrorHandling(loadColorPalette)
  }
}

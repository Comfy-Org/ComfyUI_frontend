// @ts-strict-ignore
import { useToastStore } from '@/stores/toastStore'
import { app } from '../../scripts/app'
import { $el } from '../../scripts/ui'
import type { ColorPalettes, Palette } from '@/types/colorPaletteTypes'
import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import { CORE_COLOR_PALETTES } from '@/constants/coreColorPalettes'
// Manage color palettes

const colorPalettes = CORE_COLOR_PALETTES
const id = 'Comfy.ColorPalette'
const idCustomColorPalettes = 'Comfy.CustomColorPalettes'
const defaultColorPaletteId = 'dark'
const els: { select: HTMLSelectElement | null } = {
  select: null
}

const getCustomColorPalettes = (): ColorPalettes => {
  return app.ui.settings.getSettingValue(idCustomColorPalettes, {})
}

const setCustomColorPalettes = (customColorPalettes: ColorPalettes) => {
  return app.ui.settings.setSettingValue(
    idCustomColorPalettes,
    customColorPalettes
  )
}

export const defaultColorPalette = colorPalettes[defaultColorPaletteId]
export const getColorPalette = (
  colorPaletteId?: string
): Palette | undefined => {
  if (!colorPaletteId) {
    colorPaletteId = app.ui.settings.getSettingValue(id, defaultColorPaletteId)
  }

  if (colorPaletteId.startsWith('custom_')) {
    colorPaletteId = colorPaletteId.substr(7)
    let customColorPalettes = getCustomColorPalettes()
    if (customColorPalettes[colorPaletteId]) {
      return customColorPalettes[colorPaletteId]
    }
  }

  return colorPalettes[colorPaletteId]
}

const setColorPalette = (colorPaletteId) => {
  app.ui.settings.setSettingValue(id, colorPaletteId)
}

// const ctxMenu = LiteGraph.ContextMenu;
app.registerExtension({
  name: id,
  init() {
    /**
     * Changes the background color of the canvas.
     *
     * @method updateBackground
     * @param {image} String
     * @param {clearBackgroundColor} String
     */
    // @ts-expect-error
    LGraphCanvas.prototype.updateBackground = function (
      image,
      clearBackgroundColor
    ) {
      this._bg_img = new Image()
      this._bg_img.name = image
      this._bg_img.src = image
      this._bg_img.onload = () => {
        this.draw(true, true)
      }
      this.background_image = image

      this.clear_background = true
      this.clear_background_color = clearBackgroundColor
      this._pattern = null
    }
  },
  addCustomNodeDefs(node_defs) {
    const sortObjectKeys = (unordered) => {
      return Object.keys(unordered)
        .sort()
        .reduce((obj, key) => {
          obj[key] = unordered[key]
          return obj
        }, {})
    }

    function getSlotTypes() {
      var types = []

      const defs = node_defs
      for (const nodeId in defs) {
        const nodeData = defs[nodeId]

        var inputs = nodeData['input']['required']
        if (nodeData['input']['optional'] !== undefined) {
          inputs = Object.assign(
            {},
            nodeData['input']['required'],
            nodeData['input']['optional']
          )
        }

        for (const inputName in inputs) {
          const inputData = inputs[inputName]
          const type = inputData[0]

          if (!Array.isArray(type)) {
            types.push(type)
          }
        }

        for (const o in nodeData['output']) {
          const output = nodeData['output'][o]
          types.push(output)
        }
      }

      return types
    }

    function completeColorPalette(colorPalette) {
      var types = getSlotTypes()

      for (const type of types) {
        if (!colorPalette.colors.node_slot[type]) {
          colorPalette.colors.node_slot[type] = ''
        }
      }

      colorPalette.colors.node_slot = sortObjectKeys(
        colorPalette.colors.node_slot
      )

      return colorPalette
    }

    const getColorPaletteTemplate = async () => {
      const colorPalette: Palette = {
        id: 'my_color_palette_unique_id',
        name: 'My Color Palette',
        colors: {
          node_slot: {},
          litegraph_base: {},
          comfy_base: {}
        }
      }

      // Copy over missing keys from default color palette
      const defaultColorPalette = colorPalettes[defaultColorPaletteId]
      for (const key in defaultColorPalette.colors.litegraph_base) {
        colorPalette.colors.litegraph_base[key] ||= ''
      }
      for (const key in defaultColorPalette.colors.comfy_base) {
        colorPalette.colors.comfy_base[key] ||= ''
      }

      return completeColorPalette(colorPalette)
    }

    const addCustomColorPalette = async (colorPalette) => {
      if (typeof colorPalette !== 'object') {
        useToastStore().addAlert('Invalid color palette.')
        return
      }

      if (!colorPalette.id) {
        useToastStore().addAlert('Color palette missing id.')
        return
      }

      if (!colorPalette.name) {
        useToastStore().addAlert('Color palette missing name.')
        return
      }

      if (!colorPalette.colors) {
        useToastStore().addAlert('Color palette missing colors.')
        return
      }

      if (
        colorPalette.colors.node_slot &&
        typeof colorPalette.colors.node_slot !== 'object'
      ) {
        useToastStore().addAlert('Invalid color palette colors.node_slot.')
        return
      }

      const customColorPalettes = getCustomColorPalettes()
      customColorPalettes[colorPalette.id] = colorPalette
      setCustomColorPalettes(customColorPalettes)

      for (const option of els.select.childNodes) {
        if (
          (option as HTMLOptionElement).value ===
          'custom_' + colorPalette.id
        ) {
          els.select.removeChild(option)
        }
      }

      els.select.append(
        $el('option', {
          textContent: colorPalette.name + ' (custom)',
          value: 'custom_' + colorPalette.id,
          selected: true
        })
      )

      setColorPalette('custom_' + colorPalette.id)
      await loadColorPalette(colorPalette)
    }

    const deleteCustomColorPalette = async (colorPaletteId) => {
      const customColorPalettes = getCustomColorPalettes()
      delete customColorPalettes[colorPaletteId]
      setCustomColorPalettes(customColorPalettes)

      for (const opt of els.select.childNodes) {
        const option = opt as HTMLOptionElement
        if (option.value === defaultColorPaletteId) {
          option.selected = true
        }

        if (option.value === 'custom_' + colorPaletteId) {
          els.select.removeChild(option)
        }
      }

      setColorPalette(defaultColorPaletteId)
      await loadColorPalette(getColorPalette())
    }

    const loadColorPalette = async (colorPalette: Palette) => {
      colorPalette = await completeColorPalette(colorPalette)
      if (colorPalette.colors) {
        // Sets the colors of node slots and links
        if (colorPalette.colors.node_slot) {
          Object.assign(
            app.canvas.default_connection_color_byType,
            colorPalette.colors.node_slot
          )
          Object.assign(
            LGraphCanvas.link_type_colors,
            colorPalette.colors.node_slot
          )
        }
        // Sets the colors of the LiteGraph objects
        if (colorPalette.colors.litegraph_base) {
          // Everything updates correctly in the loop, except the Node Title and Link Color for some reason
          app.canvas.node_title_color =
            colorPalette.colors.litegraph_base.NODE_TITLE_COLOR
          app.canvas.default_link_color =
            colorPalette.colors.litegraph_base.LINK_COLOR

          for (const key in colorPalette.colors.litegraph_base) {
            if (
              colorPalette.colors.litegraph_base.hasOwnProperty(key) &&
              LiteGraph.hasOwnProperty(key)
            ) {
              const value = colorPalette.colors.litegraph_base[key]
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
                LiteGraph[key] = value
              }
            }
          }
        }
        // Sets the color of ComfyUI elements
        if (colorPalette.colors.comfy_base) {
          const rootStyle = document.documentElement.style
          for (const key in colorPalette.colors.comfy_base) {
            rootStyle.setProperty(
              '--' + key,
              colorPalette.colors.comfy_base[key]
            )
          }
        }
        // Sets special case colors
        if (colorPalette.colors.litegraph_base.NODE_BYPASS_BGCOLOR) {
          app.bypassBgColor =
            colorPalette.colors.litegraph_base.NODE_BYPASS_BGCOLOR
        }
        app.canvas.setDirty(true, true)
      }
    }

    const fileInput = $el('input', {
      type: 'file',
      accept: '.json',
      style: { display: 'none' },
      parent: document.body,
      onchange: () => {
        const file = fileInput.files[0]
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          const reader = new FileReader()
          reader.onload = async () => {
            await addCustomColorPalette(JSON.parse(reader.result as string))
          }
          reader.readAsText(file)
        }
      }
    }) as HTMLInputElement

    app.ui.settings.addSetting({
      id,
      category: ['Appearance', 'ColorPalette'],
      name: 'Color Palette',
      type: (name, setter, value) => {
        const options = [
          ...Object.values(colorPalettes).map((c) =>
            $el('option', {
              textContent: c.name,
              value: c.id,
              selected: c.id === value
            })
          ),
          ...Object.values(getCustomColorPalettes()).map((c) =>
            $el('option', {
              textContent: `${c.name} (custom)`,
              value: `custom_${c.id}`,
              selected: `custom_${c.id}` === value
            })
          )
        ]

        els.select = $el(
          'select',
          {
            style: {
              marginBottom: '0.15rem',
              width: '100%'
            },
            onchange: (e) => {
              setter(e.target.value)
            }
          },
          options
        ) as HTMLSelectElement

        return $el('tr', [
          $el('td', [
            els.select,
            $el(
              'div',
              {
                style: {
                  display: 'grid',
                  gap: '4px',
                  gridAutoFlow: 'column'
                }
              },
              [
                $el('input', {
                  type: 'button',
                  value: 'Export',
                  onclick: async () => {
                    const colorPaletteId = app.ui.settings.getSettingValue(
                      id,
                      defaultColorPaletteId
                    )
                    const colorPalette = await completeColorPalette(
                      getColorPalette(colorPaletteId)
                    )
                    const json = JSON.stringify(colorPalette, null, 2) // convert the data to a JSON string
                    const blob = new Blob([json], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = $el('a', {
                      href: url,
                      download: colorPaletteId + '.json',
                      style: { display: 'none' },
                      parent: document.body
                    })
                    a.click()
                    setTimeout(function () {
                      a.remove()
                      window.URL.revokeObjectURL(url)
                    }, 0)
                  }
                }),
                $el('input', {
                  type: 'button',
                  value: 'Import',
                  onclick: () => {
                    fileInput.click()
                  }
                }),
                $el('input', {
                  type: 'button',
                  value: 'Template',
                  onclick: async () => {
                    const colorPalette = await getColorPaletteTemplate()
                    const json = JSON.stringify(colorPalette, null, 2) // convert the data to a JSON string
                    const blob = new Blob([json], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = $el('a', {
                      href: url,
                      download: 'color_palette.json',
                      style: { display: 'none' },
                      parent: document.body
                    })
                    a.click()
                    setTimeout(function () {
                      a.remove()
                      window.URL.revokeObjectURL(url)
                    }, 0)
                  }
                }),
                $el('input', {
                  type: 'button',
                  value: 'Delete',
                  onclick: async () => {
                    let colorPaletteId = app.ui.settings.getSettingValue(
                      id,
                      defaultColorPaletteId
                    )

                    if (colorPalettes[colorPaletteId]) {
                      useToastStore().addAlert(
                        'You cannot delete a built-in color palette.'
                      )
                      return
                    }

                    if (colorPaletteId.startsWith('custom_')) {
                      colorPaletteId = colorPaletteId.substr(7)
                    }

                    await deleteCustomColorPalette(colorPaletteId)
                  }
                })
              ]
            )
          ])
        ])
      },
      defaultValue: defaultColorPaletteId,
      async onChange(value) {
        if (!value) {
          return
        }

        let palette = colorPalettes[value]
        if (palette) {
          await loadColorPalette(palette)
        } else if (value.startsWith('custom_')) {
          value = value.substr(7)
          let customColorPalettes = getCustomColorPalettes()
          if (customColorPalettes[value]) {
            palette = customColorPalettes[value]
            await loadColorPalette(customColorPalettes[value])
          }
        }

        let { BACKGROUND_IMAGE, CLEAR_BACKGROUND_COLOR } =
          palette.colors.litegraph_base
        if (
          BACKGROUND_IMAGE === undefined ||
          CLEAR_BACKGROUND_COLOR === undefined
        ) {
          const base = colorPalettes['dark'].colors.litegraph_base
          BACKGROUND_IMAGE = base.BACKGROUND_IMAGE
          CLEAR_BACKGROUND_COLOR = base.CLEAR_BACKGROUND_COLOR
        }
        // @ts-expect-error
        // litegraph.extensions.js
        app.canvas.updateBackground(BACKGROUND_IMAGE, CLEAR_BACKGROUND_COLOR)
      }
    })
  }
})

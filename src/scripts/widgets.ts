// @ts-strict-ignore
import type { LGraphNode } from '@comfyorg/litegraph'
import type { IWidget } from '@comfyorg/litegraph'
import type {
  IComboWidget,
  IStringWidget
} from '@comfyorg/litegraph/dist/types/widgets'

import { useFloatWidget } from '@/composables/widgets/useFloatWidget'
import { useIntWidget } from '@/composables/widgets/useIntWidget'
import { useMarkdownWidget } from '@/composables/widgets/useMarkdownWidget'
import { useRemoteWidget } from '@/composables/widgets/useRemoteWidget'
import { useSeedWidget } from '@/composables/widgets/useSeedWidget'
import { useStringWidget } from '@/composables/widgets/useStringWidget'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { InputSpec } from '@/types/apiTypes'

import { api } from './api'
import type { ComfyApp } from './app'
import './domWidget'

export type ComfyWidgetConstructor = (
  node: LGraphNode,
  inputName: string,
  inputData: InputSpec,
  app?: ComfyApp,
  widgetName?: string
) => { widget: IWidget; minWidth?: number; minHeight?: number }

function controlValueRunBefore() {
  return useSettingStore().get('Comfy.WidgetControlMode') === 'before'
}

export function updateControlWidgetLabel(widget) {
  let replacement = 'after'
  let find = 'before'
  if (controlValueRunBefore()) {
    ;[find, replacement] = [replacement, find]
  }
  widget.label = (widget.label ?? widget.name).replace(find, replacement)
}

export const IS_CONTROL_WIDGET = Symbol()
const HAS_EXECUTED = Symbol()

export function addValueControlWidget(
  node,
  targetWidget,
  defaultValue = 'randomize',
  values,
  widgetName,
  inputData: InputSpec
) {
  let name = inputData[1]?.control_after_generate
  if (typeof name !== 'string') {
    name = widgetName
  }
  const widgets = addValueControlWidgets(
    node,
    targetWidget,
    defaultValue,
    {
      addFilterList: false,
      controlAfterGenerateName: name
    },
    inputData
  )
  return widgets[0]
}

export function addValueControlWidgets(
  node,
  targetWidget,
  defaultValue = 'randomize',
  options,
  inputData: InputSpec
) {
  if (!defaultValue) defaultValue = 'randomize'
  if (!options) options = {}

  const getName = (defaultName, optionName) => {
    let name = defaultName
    if (options[optionName]) {
      name = options[optionName]
    } else if (typeof inputData?.[1]?.[defaultName] === 'string') {
      name = inputData?.[1]?.[defaultName]
    } else if (inputData?.[1]?.control_prefix) {
      name = inputData?.[1]?.control_prefix + ' ' + name
    }
    return name
  }

  const widgets = []
  const valueControl = node.addWidget(
    'combo',
    getName('control_after_generate', 'controlAfterGenerateName'),
    defaultValue,
    function () {},
    {
      values: ['fixed', 'increment', 'decrement', 'randomize'],
      serialize: false // Don't include this in prompt.
    }
  )
  valueControl.tooltip =
    'Allows the linked widget to be changed automatically, for example randomizing the noise seed.'
  valueControl[IS_CONTROL_WIDGET] = true
  updateControlWidgetLabel(valueControl)
  widgets.push(valueControl)

  const isCombo = targetWidget.type === 'combo'
  let comboFilter
  if (isCombo) {
    valueControl.options.values.push('increment-wrap')
  }
  if (isCombo && options.addFilterList !== false) {
    comboFilter = node.addWidget(
      'string',
      getName('control_filter_list', 'controlFilterListName'),
      '',
      function () {},
      {
        serialize: false // Don't include this in prompt.
      }
    )
    updateControlWidgetLabel(comboFilter)
    comboFilter.tooltip =
      "Allows for filtering the list of values when changing the value via the control generate mode. Allows for RegEx matches in the format /abc/ to only filter to values containing 'abc'."

    widgets.push(comboFilter)
  }

  const applyWidgetControl = () => {
    var v = valueControl.value

    if (isCombo && v !== 'fixed') {
      let values = targetWidget.options.values
      const filter = comboFilter?.value
      if (filter) {
        let check
        if (filter.startsWith('/') && filter.endsWith('/')) {
          try {
            const regex = new RegExp(filter.substring(1, filter.length - 1))
            check = (item) => regex.test(item)
          } catch (error) {
            console.error(
              'Error constructing RegExp filter for node ' + node.id,
              filter,
              error
            )
          }
        }
        if (!check) {
          const lower = filter.toLocaleLowerCase()
          check = (item) => item.toLocaleLowerCase().includes(lower)
        }
        values = values.filter((item) => check(item))
        if (!values.length && targetWidget.options.values.length) {
          console.warn(
            'Filter for node ' + node.id + ' has filtered out all items',
            filter
          )
        }
      }
      let current_index = values.indexOf(targetWidget.value)
      let current_length = values.length

      switch (v) {
        case 'increment':
          current_index += 1
          break
        case 'increment-wrap':
          current_index += 1
          if (current_index >= current_length) {
            current_index = 0
          }
          break
        case 'decrement':
          current_index -= 1
          break
        case 'randomize':
          current_index = Math.floor(Math.random() * current_length)
          break
        default:
          break
      }
      current_index = Math.max(0, current_index)
      current_index = Math.min(current_length - 1, current_index)
      if (current_index >= 0) {
        let value = values[current_index]
        targetWidget.value = value
        targetWidget.callback(value)
      }
    } else {
      //number
      let min = targetWidget.options.min
      let max = targetWidget.options.max
      // limit to something that javascript can handle
      max = Math.min(1125899906842624, max)
      min = Math.max(-1125899906842624, min)
      let range = (max - min) / (targetWidget.options.step / 10)

      //adjust values based on valueControl Behaviour
      switch (v) {
        case 'fixed':
          break
        case 'increment':
          targetWidget.value += targetWidget.options.step / 10
          break
        case 'decrement':
          targetWidget.value -= targetWidget.options.step / 10
          break
        case 'randomize':
          targetWidget.value =
            Math.floor(Math.random() * range) *
              (targetWidget.options.step / 10) +
            min
          break
        default:
          break
      }
      /*check if values are over or under their respective
       * ranges and set them to min or max.*/
      if (targetWidget.value < min) targetWidget.value = min

      if (targetWidget.value > max) targetWidget.value = max
      targetWidget.callback(targetWidget.value)
    }
  }

  valueControl.beforeQueued = () => {
    if (controlValueRunBefore()) {
      // Don't run on first execution
      if (valueControl[HAS_EXECUTED]) {
        applyWidgetControl()
      }
    }
    valueControl[HAS_EXECUTED] = true
  }

  valueControl.afterQueued = () => {
    if (!controlValueRunBefore()) {
      applyWidgetControl()
    }
  }

  return widgets
}

const SeedWidget = useSeedWidget()

export const ComfyWidgets: Record<string, ComfyWidgetConstructor> = {
  'INT:seed': SeedWidget,
  'INT:noise_seed': SeedWidget,
  INT: useIntWidget(),
  FLOAT: useFloatWidget(),
  BOOLEAN(node, inputName, inputData) {
    let defaultVal = false
    let options = {}
    if (inputData[1]) {
      if (inputData[1].default) defaultVal = inputData[1].default
      if (inputData[1].label_on) options['on'] = inputData[1].label_on
      if (inputData[1].label_off) options['off'] = inputData[1].label_off
    }
    return {
      widget: node.addWidget('toggle', inputName, defaultVal, () => {}, options)
    }
  },
  STRING: useStringWidget(),
  MARKDOWN: useMarkdownWidget(),
  COMBO(node, inputName, inputData: InputSpec) {
    const widgetStore = useWidgetStore()
    const { remote, options } = inputData[1]
    const defaultValue = widgetStore.getDefaultValue(inputData)

    const res = {
      widget: node.addWidget('combo', inputName, defaultValue, () => {}, {
        values: options ?? inputData[0]
      }) as IComboWidget
    }

    if (remote) {
      const remoteWidget = useRemoteWidget(inputData)

      const origOptions = res.widget.options
      res.widget.options = new Proxy(
        origOptions as Record<string | symbol, any>,
        {
          get(target, prop: string | symbol) {
            if (prop !== 'values') return target[prop]

            remoteWidget.fetchOptions().then((options) => {
              if (!options || !options.length) return

              const isUninitialized =
                res.widget.value === remoteWidget.defaultValue &&
                !res.widget.options.values?.includes(remoteWidget.defaultValue)
              if (isUninitialized) {
                res.widget.value = options[0]
                res.widget.callback?.(options[0])
                node.graph?.setDirtyCanvas(true)
              }
            })

            const current = remoteWidget.getCacheEntry()
            return current?.data || widgetStore.getDefaultValue(inputData)
          }
        }
      )
    }

    if (inputData[1]?.control_after_generate) {
      // TODO make combo handle a widget node type?
      res.widget.linkedWidgets = addValueControlWidgets(
        node,
        res.widget,
        undefined,
        undefined,
        inputData
      )
    }
    return res
  },
  IMAGEUPLOAD(node: LGraphNode, inputName: string, inputData: InputSpec, app) {
    // TODO make image upload handle a custom node type?
    const imageWidget = node.widgets.find(
      (w) => w.name === (inputData[1]?.widget ?? 'image')
    ) as IStringWidget
    let uploadWidget
    const { image_folder = 'input' } = inputData[1] ?? {}

    function showImage(name) {
      const img = new Image()
      img.onload = () => {
        node.imgs = [img]
        app.graph.setDirtyCanvas(true)
      }
      let folder_separator = name.lastIndexOf('/')
      let subfolder = ''
      if (folder_separator > -1) {
        subfolder = name.substring(0, folder_separator)
        name = name.substring(folder_separator + 1)
      }
      img.src = api.apiURL(
        `/view?filename=${encodeURIComponent(name)}&type=${image_folder}&subfolder=${subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`
      )
      node.setSizeForImage?.()
    }

    var default_value = imageWidget.value
    Object.defineProperty(imageWidget, 'value', {
      set: function (value) {
        this._real_value = value
      },

      get: function () {
        if (!this._real_value) {
          return default_value
        }

        let value = this._real_value
        if (value.filename) {
          let real_value = value
          value = ''
          if (real_value.subfolder) {
            value = real_value.subfolder + '/'
          }

          value += real_value.filename

          if (real_value.type && real_value.type !== 'input')
            value += ` [${real_value.type}]`
        }
        return value
      }
    })

    // Add our own callback to the combo widget to render an image when it changes
    // TODO: Explain this?
    // @ts-expect-error
    const cb = node.callback
    imageWidget.callback = function () {
      showImage(imageWidget.value)
      if (cb) {
        return cb.apply(this, arguments)
      }
    }

    // On load if we have a value then render the image
    // The value isnt set immediately so we need to wait a moment
    // No change callbacks seem to be fired on initial setting of the value
    requestAnimationFrame(() => {
      if (imageWidget.value) {
        showImage(imageWidget.value)
      }
    })

    async function uploadFile(file, updateNode, pasted = false) {
      try {
        // Wrap file in formdata so it includes filename
        const body = new FormData()
        body.append('image', file)
        if (pasted) body.append('subfolder', 'pasted')
        const resp = await api.fetchApi('/upload/image', {
          method: 'POST',
          body
        })

        if (resp.status === 200) {
          const data = await resp.json()
          // Add the file to the dropdown list and update the widget value
          let path = data.name
          if (data.subfolder) path = data.subfolder + '/' + path

          if (!imageWidget.options.values.includes(path)) {
            imageWidget.options.values.push(path)
          }

          if (updateNode) {
            showImage(path)
            imageWidget.value = path
          }
        } else {
          useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
        }
      } catch (error) {
        useToastStore().addAlert(error)
      }
    }

    const fileInput = document.createElement('input')
    Object.assign(fileInput, {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      style: 'display: none',
      onchange: async () => {
        if (fileInput.files.length) {
          await uploadFile(fileInput.files[0], true)
        }
      }
    })
    document.body.append(fileInput)

    // Create the button widget for selecting the files
    uploadWidget = node.addWidget('button', inputName, 'image', () => {
      fileInput.click()
    })
    uploadWidget.label = 'choose file to upload'
    uploadWidget.serialize = false

    // Add handler to check if an image is being dragged over our node
    node.onDragOver = function (e: DragEvent) {
      if (e.dataTransfer && e.dataTransfer.items) {
        const image = [...e.dataTransfer.items].find((f) => f.kind === 'file')
        return !!image
      }

      return false
    }

    // On drop upload files
    node.onDragDrop = function (e: DragEvent) {
      console.log('onDragDrop called')
      let handled = false
      for (const file of e.dataTransfer.files) {
        if (file.type.startsWith('image/')) {
          uploadFile(file, !handled) // Dont await these, any order is fine, only update on first one
          handled = true
        }
      }

      return handled
    }

    node.pasteFile = function (file: File) {
      if (file.type.startsWith('image/')) {
        const is_pasted =
          file.name === 'image.png' && file.lastModified - Date.now() < 2000
        uploadFile(file, true, is_pasted)
        return true
      }
      return false
    }

    return { widget: uploadWidget }
  }
}

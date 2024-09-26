import { LiteGraph, LGraphCanvas } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'
import { getColorPalette } from './colorPalette'
import { ComfyWidgets } from '../../scripts/widgets'
import { LGraphNode } from '@comfyorg/litegraph'
import type { IWidget, widgetTypes } from '@comfyorg/litegraph'

function inner_value_change(widget, value, node, pos) {
  widget.value = value
  if (
    widget.options &&
    widget.options.property &&
    node.properties[widget.options.property] !== undefined
  ) {
    node.setProperty(widget.options.property, value)
  }
  if (widget.callback) {
    widget.callback(this.value, app.canvas, node, event)
  }
}

function button_action(widget) {
  if (
    widget.options?.reset == undefined &&
    widget.options?.disable == undefined
  ) {
    return 'None'
  }
  if (
    widget.options.reset != undefined &&
    widget.value != widget.options.reset
  ) {
    return 'Reset'
  }
  if (
    widget.options.disable != undefined &&
    widget.value != widget.options.disable
  ) {
    return 'Disable'
  }
  if (widget.options.reset) {
    return 'No Reset'
  }
  return 'No Disable'
}

function draw(ctx, node, widget_width, y, H) {
  const litegraph_base = getColorPalette().colors.litegraph_base
  const show_text = app.canvas.ds.scale > 0.5
  const margin = 15
  ctx.textAlign = 'left'
  ctx.strokeStyle = litegraph_base.WIDGET_OUTLINE_COLOR
  ctx.fillStyle = litegraph_base.WIDGET_BGCOLOR
  ctx.beginPath()
  if (show_text)
    ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])
  else ctx.rect(margin, y, widget_width - margin * 2, H)
  ctx.fill()
  if (show_text) {
    if (!this.disabled) ctx.stroke()
    const button = button_action(this)
    const padding = button == 'None' ? 0 : 20
    if (button != 'None') {
      ctx.save()
      ctx.font = ctx.font.split(' ')[0] + ' monospace'
      if (button.startsWith('No ')) {
        ctx.fillStyle = litegraph_base.WIDGET_OUTLINE_COLOR
      } else {
        ctx.fillStyle = litegraph_base.WIDGET_TEXT_COLOR
      }
      if (button.endsWith('Reset')) {
        ctx.fillText('\u21ba', margin + 6, y + H * 0.7)
      } else {
        ctx.fillText('\u2298', margin + 6, y + H * 0.7)
      }
      ctx.restore()
    }
    ctx.fillStyle = litegraph_base.WIDGET_TEXT_COLOR
    if (!this.disabled) {
      ctx.beginPath()
      ctx.moveTo(margin + 16 + padding, y + 5)
      ctx.lineTo(margin + 6 + padding, y + H * 0.5)
      ctx.lineTo(margin + 16 + padding, y + H - 5)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(widget_width - margin - 16, y + 5)
      ctx.lineTo(widget_width - margin - 6, y + H * 0.5)
      ctx.lineTo(widget_width - margin - 16, y + H - 5)
      ctx.fill()
    }
    ctx.fillStyle = litegraph_base.WIDGET_SECONDARY_TEXT_COLOR
    ctx.fillText(this.label || this.name, margin * 2 + 5 + padding, y + H * 0.7)
    ctx.fillStyle = litegraph_base.WIDGET_TEXT_COLOR
    ctx.textAlign = 'right'
    const text = Number(this.value).toFixed(
      this.options.precision !== undefined ? this.options.precision : 3
    )
    ctx.fillText(text, widget_width - margin * 2 - 20, y + H * 0.7)
    let annotation = ''
    if (this.annotation) {
      annotation = this.annotation(this.value)
    } else if (
      this.options.annotation &&
      this.value in this.options.annotation
    ) {
      annotation = this.options.annotation[this.value]
    }
    if (annotation) {
      //TODO: measure this text
      ctx.fillStyle = litegraph_base.WIDGET_OUTLINE_COLOR
      const value_width = ctx.measureText(text).width
      ctx.fillText(
        annotation,
        widget_width - margin * 2 - 25 - value_width,
        y + H * 0.7
      )
    }
  }
}
function mouse(event, [x, y], node) {
  const button = button_action(this)
  const padding = button == 'None' ? 0 : 20
  const widget_width = this.width || node.size[0]
  const old_value = this.value
  const delta = x < 40 + padding ? -1 : x > widget_width - 40 ? 1 : 0
  const margin = 15
  var allow_scroll = true
  if (delta) {
    if (x > -3 && x < widget_width + 3) {
      allow_scroll = false
    }
  }
  if (allow_scroll && event.type == 'pointermove') {
    if (event.deltaX)
      this.value += event.deltaX * 0.1 * (this.options.step || 1)
    if (this.options.min != null && this.value < this.options.min) {
      this.value = this.options.min
    }
    if (this.options.max != null && this.value > this.options.max) {
      this.value = this.options.max
    }
  } else if (event.type == 'pointerdown') {
    if (x < padding + margin) {
      if (button == 'Reset') {
        this.value = this.options.reset
      } else if (button == 'Disable') {
        this.value = this.options.disable
      }
    } else {
      this.value += delta * 0.1 * (this.options.step || 1)
      if (this.options.min != null && this.value < this.options.min) {
        this.value = this.options.min
      }
      if (this.options.max != null && this.value > this.options.max) {
        this.value = this.options.max
      }
    }
  } //end mousedown
  else if (event.type == 'pointerup') {
    if (event.click_time < 200 && delta == 0) {
      app.canvas.prompt(
        'Value',
        this.value,
        function (v) {
          //NOTE: Original code uses eval here. This will not be reproduced
          this.value = Number(v)
          inner_value_change(this, this.value, node, [x, y])
        }.bind(this),
        event
      )
    }
  }

  if (old_value != this.value)
    setTimeout(
      function () {
        inner_value_change(this, this.value, node, [x, y])
      }.bind(this),
      20
    )
  return true
}
class AnnotatedNumber implements IWidget {
  // @ts-expect-error We must forcibly set a type here to allow custom mouse and draw
  type: widgetTypes = 'annotatedNumber'
  draw = draw
  mouse = mouse
  options = {}
  linkedWidgets = []
  name: string
  value: number
  annotation: (value: number) => string
  computeSize(width: number): [number, number] {
    return [width, 20]
  }
  constructor(inputName, inputData) {
    this.name = inputName
    if (inputData.length > 1) {
      this.options = inputData[1]
      for (let k of ['default', 'min', 'max']) {
        if (inputData[1][k] != undefined) {
          this.value = inputData[1][k]
          break
        }
      }
    }
  }
}

function annotatedNumber(node, inputName, inputData, app): { widget: IWidget } {
  let w = new AnnotatedNumber(inputName, inputData)
  if (!node.widgets) {
    node.widgets = []
  }
  node.widgets.push(w)
  return { widget: w }
}
const originalFLOAT = ComfyWidgets.FLOAT
ComfyWidgets.FLOAT = function (
  node,
  inputName,
  inputData,
  app
): { widget: IWidget } {
  if (
    inputData[1]?.reset == undefined &&
    inputData[1]?.disable == undefined &&
    inputData[1]?.annotation == undefined
  ) {
    return originalFLOAT(node, inputName, inputData, app)
  }
  if (inputData[1]['display'] === 'slider') {
    return originalFLOAT(node, inputName, inputData, app)
  }
  return annotatedNumber(node, inputName, inputData, app)
}
const originalINT = ComfyWidgets.INT
ComfyWidgets.INT = function (
  node,
  inputName,
  inputData,
  app
): { widget: IWidget } {
  if (
    inputData[1]?.reset ||
    inputData[1]?.disable ||
    inputData[1]?.annotation
  ) {
    return annotatedNumber(node, inputName, inputData, app)
  }
  return originalINT(node, inputName, inputData, app)
}

app.registerExtension({
  name: 'Comfy.AnnotatedNumber',
  async getCustomWidgets(app) {
    return {
      ANNOTATEDNUMBER: annotatedNumber
    }
  },
  registerCustomNodes() {
    class TestNum extends LGraphNode {
      static category = 'utils'
      isVirtualNode = true
      collapsable = true
      title_mode = LiteGraph.NORMAL_TITLE
      title = 'testNum'

      constructor(title?: string) {
        super(title)
        app.widgets.ANNOTATEDNUMBER(
          // Should we extends LGraphNode?  Yesss
          this,
          'x',
          [
            'ANNOTATEDNUMBER',
            {
              default: 5,
              reset: 5,
              disable: 0,
              annotation: { 6: 'def+1', 5: 'default', 0: 'disabled' },
              step: 10
            }
          ],
          app
        )
        let annotatedWidget = this.widgets[0] as AnnotatedNumber
        annotatedWidget.annotation = function (value) {
          return ['smol', 'medium', 'big', 'real big'][
            Math.floor(Math.log10(value))
          ]
        }
      }
    }
    // Load default visibility

    LiteGraph.registerNodeType('TestNum', TestNum)
  }
})

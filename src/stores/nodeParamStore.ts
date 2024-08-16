// should apply this to litegraph node
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { app } from '@/scripts/app'

// todo: Use Litegraph.js types here when we have a Litegraph ts version or Zod Schema
export interface Widget {
  title: string
  type: string
  label: string
  options: any
  value: object | string | number | boolean | Array<any> | null
  fav: boolean
}

export interface Node {
  title: string
  id: number
  order: number
  color: string
  bypass: boolean
  bgcolor: string
  mode: number
  favWidgets: FavWidgets[]
  category: string
  widgets: Widget[]
}

export interface FavWidgets {
  name: string
  fav: boolean
}

export interface category {
  name: string
  count: number
}

export const useNodeParamStore = defineStore('nodeParam', () => {
  // State
  // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
  const nodes = ref<Node[]>([...app.graph._nodes])
  const widgetFav = ref<Widget[]>([])
  const categories = computed<category[]>(() => {
    let favCount = 0
    for (const node of nodes.value) {
      for (const widget of node.widgets)
        if (widget.fav) {
          favCount++
        }
    }
    return [
      { name: 'All', count: nodes.value.length },
      { name: 'Star', count: favCount },
      {
        name: 'Notnull',
        count: nodes.value.filter((node) => node.widgets.length > 0).length
      }
    ]
  })

  //getters
  let isEditing = false
  const setIsEditing = (value: boolean) => {
    isEditing = value
  }
  const allNodes = computed(() => nodes.value)

  const favNodes = computed(() =>
    nodes.value
      .map((node) => {
        const favWidgets = node.widgets.filter((widget) => widget.fav)
        if (favWidgets.length > 0) {
          return {
            ...node,
            widgets: favWidgets
          }
        }
        return null
      })
      .filter((node) => node !== null)
  )

  const notNullNodes = computed(() =>
    nodes.value.filter((node) => node.widgets.length > 0)
  )
  // Actions
  const updateNodes = () => {
    // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
    const graphNodes = ref([...app.graph._nodes])

    //todo: remove this when app.graph._nodes supports ref()
    setInterval(() => {
      if (!isEditing) {
        // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
        graphNodes.value = [...app.graph._nodes]
      }
    }, 1000)

    // sync GraphNode to Pinia Store
    watch(
      () => graphNodes.value,
      (newOrigin) => {
        nodes.value = newOrigin.map((graphNode) => ({
          title: graphNode.title,
          id: graphNode.id,
          order: null,
          color: graphNode.color,
          bgcolor: graphNode.bgcolor,
          // @ts-expect-error graphNode.mode = 4 is not defined in types
          bypass: graphNode.mode === 4 || graphNode.mode === 2,
          mode: graphNode.mode,
          category: 'null',
          favWidgets: graphNode.widgets
            ? graphNode.properties.favWidgets
              ? graphNode.properties.favWidgets
              : graphNode.widgets.map((widget) => ({
                  name: widget.name,
                  fav: false
                }))
            : [],
          widgets: graphNode.widgets
            ? graphNode.widgets.map((widget) => ({
                title: widget.name,
                type: widget.type,
                // @ts-expect-error widget.label is not defined in types
                // get button widget label text
                label: widget.label ? widget.label : null,
                value: widget.value,
                fav: graphNode.properties.favWidgets
                  ? graphNode.properties.favWidgets.find(
                      (favWidget) => favWidget.name == widget.name
                    ).fav
                  : false,
                options: widget.options ? widget.options : []
              }))
            : []
        }))
      },
      { immediate: true }
    )
  }

  const updateNodeMode = (nodeId: number, isOn: boolean) => {
    // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
    const graphNode = app.graph._nodes.find((node) => node.id === nodeId)

    if (graphNode) {
      if (isOn) {
        // @ts-expect-error graphNode.mode = 4 is not defined in types
        // bypass graphNode
        graphNode.mode = 4
      } else {
        graphNode.mode = 0
      }
      app.graph.setDirtyCanvas(true)
    }
  }
  const updateWidgetValue = (
    nodeId: number,
    widgetTitle: string,
    newValue: any
  ) => {
    // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
    const node = app.graph._nodes.find((node) => node.id === nodeId)
    if (node) {
      const widget = node.widgets.find((widget) => widget.name === widgetTitle)
      if (widget) {
        widget.value = newValue
        if (widget.type === 'combo') {
          // @ts-expect-error widget.callback() is not defined in types
          // trigger on combo option selected to update LGraphCanvas
          widget.callback()
        }
      }
    }
    app.graph.setDirtyCanvas(true)
  }
  const clickWidgetButton = (nodeId: number, widgetTitle: string) => {
    // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
    const node = app.graph._nodes.find((node) => node.id === nodeId)
    if (node) {
      const widget = node.widgets.find((widget) => widget.name === widgetTitle)
      if (widget) {
        // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
        widget.callback()
      }
    }
  }

  const updateWidgetFav = (
    nodeId: number,
    widgetTitle: string,
    fav: boolean
  ) => {
    isEditing = true
    // @ts-expect-error app.graph._nodes is private, there's no export functions to access it
    const graphNode = app.graph._nodes.find((node) => node.id === nodeId)

    //update graphNode favWidgets
    if (graphNode.properties.favWidgets) {
      graphNode.properties.favWidgets.find(
        (widget) => widget.name === widgetTitle
      ).fav = fav
    } else {
      // @ts-expect-error LGraphNode.addProperty is not defined in types
      // add this to save to workflow.json
      graphNode.addProperty('favWidgets', [])
      graphNode.properties.favWidgets = graphNode.widgets.map((widget) => ({
        name: widget.name,
        fav: false
      }))
      graphNode.properties.favWidgets.find(
        (widget) => widget.name === widgetTitle
      ).fav = fav
    }

    isEditing = false
  }

  return {
    nodes,
    widgetFav,
    setIsEditing,
    categories,
    updateNodes,
    updateNodeMode,
    updateWidgetValue,
    updateWidgetFav,
    allNodes,
    favNodes,
    notNullNodes,
    clickWidgetButton
  }
})

// should apply this to litegraph node
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { app } from '@/scripts/app'

// todo: Use Litegraph.js types here when we have a Litegraph ts version or Zod Schema
interface Widget {
  title: string
  type: string
  label: string
  options: any
  value: object | string | number | boolean | Array<any> | null
  fav: boolean
}

interface Node {
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

interface FavWidgets {
  name: string
  fav: boolean
}

// interface Gallery {
//     images: string[];
// }

interface category {
  name: string
  count: number
}

export const useNodeParamStore = defineStore('nodeParam', () => {
  // State
  const nodes = ref<Node[]>([])
  const widgetFav = ref<Widget[]>([])
  const filterNodes = ref(nodes)
  const categories = computed<category[]>(() => {
    let favCount = 0
    for (let node of nodes.value) {
      for (let widget of node.widgets)
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
  // const gallery = ref<Gallery>({ images: [] });

  let isEditing = false

  //Setters
  const setIsEditing = (value: boolean) => {
    isEditing = value
  }
  // Actions
  const updateNodes = () => {
    // @ts-expect-error
    const graphNodes = ref([...app.graph._nodes])

    //todo: remove this when app.graph._nodes supports ref()
    setInterval(() => {
      if (!isEditing) {
        // @ts-expect-error
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
          // @ts-expect-error
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
                // @ts-expect-error
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
      { deep: true, immediate: true }
    )
  }

  const updateNodeMode = (nodeId: number, isOn: boolean) => {
    // @ts-expect-error
    const graphNode = app.graph._nodes.find((node) => node.id === nodeId)

    if (graphNode) {
      if (isOn) {
        // @ts-expect-error
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
    // @ts-expect-error
    const node = app.graph._nodes.find((node) => node.id === nodeId)
    if (node) {
      const widget = node.widgets.find((widget) => widget.name === widgetTitle)
      if (widget) {
        widget.value = newValue
        // @ts-expect-error
        if (widget.type === 'combo') {
          widget.callback()
        }
      }
    }
    app.graph.setDirtyCanvas(true)
  }
  const clickWidgetButton = (nodeId: number, widgetTitle: string) => {
    // @ts-expect-error
    const node = app.graph._nodes.find((node) => node.id === nodeId)
    if (node) {
      const widget = node.widgets.find((widget) => widget.name === widgetTitle)
      if (widget) {
        // @ts-expect-error
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
    // @ts-expect-error
    const graphNode = app.graph._nodes.find((node) => node.id === nodeId)

    //update graphNode favWidgets
    if (graphNode.properties.favWidgets) {
      graphNode.properties.favWidgets.find(
        (widget) => widget.name === widgetTitle
      ).fav = fav
    } else {
      // @ts-expect-error
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

  const updateCatagories = (category) => {
    switch (category) {
      case 'All':
        filterNodes.value = nodes.value
        break
      case 'Star':
        filterFavNodes()
        break
      case 'Notnull':
        filterNodes.value = nodes.value.filter(
          (node) => node.widgets.length > 0
        )
        break
      case null:
        filterNodes.value = nodes.value
        break
      default:
        break
    }
  }
  const filterFavNodes = () => {
    filterNodes.value = nodes.value
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
      .filter((node) => node !== null) // 过滤掉 null 值
  }

  // const addGalleryImage = (image: string) => {
  //     gallery.value.images.push(image);
  // };

  // const removeGalleryImage = (image: string) => {
  //     gallery.value.images = gallery.value.images.filter(img => img !== image);
  // };

  // //todo: manual edit orders
  // const updateNodeOrder = (nodeId: number, order: number) => {
  //     const node = nodes.value.find(node => node.id === nodeId);
  //     if (node) {
  //         node.order = order;
  //     }
  // };

  return {
    nodes,
    filterNodes,
    widgetFav,
    setIsEditing,
    categories,
    updateNodes,
    updateNodeMode,
    updateWidgetValue,
    updateWidgetFav,
    updateCatagories,
    clickWidgetButton
    // updateNodeOrder,
    // gallery,
    // addGalleryImage,
    // removeGalleryImage,
  }
})

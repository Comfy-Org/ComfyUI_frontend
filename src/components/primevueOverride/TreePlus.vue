<!-- Tree with all leaf nodes draggable -->
<script>
import Tree from 'primevue/tree'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { h, onMounted, onBeforeUnmount, computed } from 'vue'

export default {
  name: 'TreePlus',
  extends: Tree,
  props: {
    dragSelector: {
      type: String,
      default: '.p-tree-node'
    },
    // Explicitly declare all v-model props
    expandedKeys: {
      type: Object,
      default: () => ({})
    },
    selectionKeys: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:expandedKeys', 'update:selectionKeys'],
  setup(props, context) {
    // Create computed properties for each v-model prop
    const computedExpandedKeys = computed({
      get: () => props.expandedKeys,
      set: (value) => context.emit('update:expandedKeys', value)
    })

    const computedSelectionKeys = computed({
      get: () => props.selectionKeys,
      set: (value) => context.emit('update:selectionKeys', value)
    })

    let observer = null

    const makeDraggable = (element) => {
      if (!element._draggableCleanup) {
        element._draggableCleanup = draggable({
          element
        })
      }
    }

    const observeTreeChanges = (treeElement) => {
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                node.querySelectorAll(props.dragSelector).forEach(makeDraggable)
              }
            })
          }
        })
      })

      observer.observe(treeElement, { childList: true, subtree: true })

      // Make existing nodes draggable
      treeElement.querySelectorAll(props.dragSelector).forEach(makeDraggable)
    }

    onMounted(() => {
      const treeElement = document.querySelector('.p-tree')
      if (treeElement) {
        observeTreeChanges(treeElement)
      }
    })

    onBeforeUnmount(() => {
      if (observer) {
        observer.disconnect()
      }
      // Clean up draggable instances if necessary
      const treeElement = document.querySelector('.p-tree')
      if (treeElement) {
        treeElement.querySelectorAll(props.dragSelector).forEach((node) => {
          if (node._draggableCleanup) {
            node._draggableCleanup()
          }
        })
      }
    })

    return () =>
      h(
        Tree,
        {
          ...context.attrs,
          ...props,
          expandedKeys: computedExpandedKeys.value,
          selectionKeys: computedSelectionKeys.value,
          'onUpdate:expandedKeys': (value) =>
            (computedExpandedKeys.value = value),
          'onUpdate:selectionKeys': (value) =>
            (computedSelectionKeys.value = value)
        },
        context.slots
      )
  }
}
</script>

import { ref, computed } from 'vue'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

export function useCanvasHistory(maxStates = 20) {
  const store = useMaskEditorStore()

  const states = ref<{ mask: ImageData; rgb: ImageData }[]>([])
  const currentStateIndex = ref(-1)
  const initialized = ref(false)

  const canUndo = computed(
    () => states.value.length > 1 && currentStateIndex.value > 0
  )

  const canRedo = computed(() => {
    return (
      states.value.length > 1 &&
      currentStateIndex.value < states.value.length - 1
    )
  })

  const saveInitialState = () => {
    const maskCtx = store.maskCtx
    const rgbCtx = store.rgbCtx
    const maskCanvas = store.maskCanvas
    const rgbCanvas = store.rgbCanvas

    if (!maskCtx || !rgbCtx || !maskCanvas || !rgbCanvas) {
      requestAnimationFrame(saveInitialState)
      return
    }

    if (!maskCanvas.width || !rgbCanvas.width) {
      requestAnimationFrame(saveInitialState)
      return
    }

    states.value = []
    const maskState = maskCtx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    )
    const rgbState = rgbCtx.getImageData(
      0,
      0,
      rgbCanvas.width,
      rgbCanvas.height
    )
    states.value.push({ mask: maskState, rgb: rgbState })
    currentStateIndex.value = 0
    initialized.value = true
  }

  const saveState = () => {
    const maskCtx = store.maskCtx
    const rgbCtx = store.rgbCtx
    const maskCanvas = store.maskCanvas
    const rgbCanvas = store.rgbCanvas

    if (!maskCtx || !rgbCtx || !maskCanvas || !rgbCanvas) return

    if (!initialized.value || currentStateIndex.value === -1) {
      saveInitialState()
      return
    }

    states.value = states.value.slice(0, currentStateIndex.value + 1)

    const maskState = maskCtx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    )
    const rgbState = rgbCtx.getImageData(
      0,
      0,
      rgbCanvas.width,
      rgbCanvas.height
    )
    states.value.push({ mask: maskState, rgb: rgbState })
    currentStateIndex.value++

    if (states.value.length > maxStates) {
      states.value.shift()
      currentStateIndex.value--
    }
  }

  const undo = () => {
    if (!canUndo.value) {
      alert('No more undo states available')
      return
    }

    currentStateIndex.value--
    restoreState(states.value[currentStateIndex.value])
  }

  const redo = () => {
    if (!canRedo.value) {
      alert('No more redo states available')
      return
    }

    currentStateIndex.value++
    restoreState(states.value[currentStateIndex.value])
  }

  const restoreState = (state: { mask: ImageData; rgb: ImageData }) => {
    const maskCtx = store.maskCtx
    const rgbCtx = store.rgbCtx
    if (!maskCtx || !rgbCtx) return

    maskCtx.putImageData(state.mask, 0, 0)
    rgbCtx.putImageData(state.rgb, 0, 0)
  }

  const clearStates = () => {
    states.value = []
    currentStateIndex.value = -1
    initialized.value = false
  }

  return {
    canUndo,
    canRedo,
    saveInitialState,
    saveState,
    undo,
    redo,
    clearStates
  }
}

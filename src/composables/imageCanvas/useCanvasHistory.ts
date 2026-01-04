import { ref, computed } from 'vue'
import { useimageCanvasStore } from '@/stores/imageCanvasStore'

export function useCanvasHistory(maxStates = 20) {
  const store = useimageCanvasStore()

  const states = ref<
    { mask: ImageData | ImageBitmap; rgb: ImageData | ImageBitmap }[]
  >([])
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

  const saveState = (
    providedMaskData?: ImageData | ImageBitmap,
    providedRgbData?: ImageData | ImageBitmap
  ) => {
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

    let maskState: ImageData | ImageBitmap
    let rgbState: ImageData | ImageBitmap

    if (providedMaskData && providedRgbData) {
      maskState = providedMaskData
      rgbState = providedRgbData
    } else {
      maskState = maskCtx.getImageData(
        0,
        0,
        maskCanvas.width,
        maskCanvas.height
      )
      rgbState = rgbCtx.getImageData(0, 0, rgbCanvas.width, rgbCanvas.height)
    }

    states.value.push({ mask: maskState, rgb: rgbState })
    currentStateIndex.value++

    if (states.value.length > maxStates) {
      const removed = states.value.shift()
      // Cleanup ImageBitmaps to avoid memory leaks
      if (removed) {
        if (removed.mask instanceof ImageBitmap) removed.mask.close()
        if (removed.rgb instanceof ImageBitmap) removed.rgb.close()
      }
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

  const restoreState = (state: {
    mask: ImageData | ImageBitmap
    rgb: ImageData | ImageBitmap
  }) => {
    const maskCtx = store.maskCtx
    const rgbCtx = store.rgbCtx
    if (!maskCtx || !rgbCtx) return

    if (state.mask instanceof ImageBitmap) {
      maskCtx.clearRect(0, 0, state.mask.width, state.mask.height)
      maskCtx.drawImage(state.mask, 0, 0)
    } else {
      maskCtx.putImageData(state.mask, 0, 0)
    }

    if (state.rgb instanceof ImageBitmap) {
      rgbCtx.clearRect(0, 0, state.rgb.width, state.rgb.height)
      rgbCtx.drawImage(state.rgb, 0, 0)
    } else {
      rgbCtx.putImageData(state.rgb, 0, 0)
    }
  }

  const clearStates = () => {
    // Cleanup bitmaps
    states.value.forEach((state) => {
      if (state.mask instanceof ImageBitmap) state.mask.close()
      if (state.rgb instanceof ImageBitmap) state.rgb.close()
    })
    states.value = []
    currentStateIndex.value = -1
    initialized.value = false
  }

  return {
    canUndo,
    canRedo,
    currentStateIndex,
    saveInitialState,
    saveState,
    undo,
    redo,
    clearStates
  }
}

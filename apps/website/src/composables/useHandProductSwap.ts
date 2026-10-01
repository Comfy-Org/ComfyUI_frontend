import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '../i18n/translations'
import type {
  HandSwapResult,
  SwapResolution
} from '../lib/workshop/hand-product-swap/contract'
import { swapRequest } from '../lib/workshop/hand-product-swap/contract'
import { hc } from '../lib/workshop/hand-product-swap/copy'
import type {
  SwapImage,
  SwapProduct
} from '../lib/workshop/hand-product-swap/examples'
import {
  EXAMPLE_PRODUCTS,
  HAND_EXAMPLE,
  OWN_PRODUCT_ID
} from '../lib/workshop/hand-product-swap/examples'
import * as history from '../lib/workshop/hand-product-swap/history'
import { runHandSwap } from '../lib/workshop/hand-product-swap/mock-run'
import { STARTING_BOX } from '../lib/workshop/hand-product-swap/placement'
import { imageSize } from '../lib/workshop/image-size'
import type { Rect } from '../lib/workshop/move-anything/arrange'

/** Everything undo and redo cover. */
interface SwapSetup {
  readonly region: Rect
  readonly productId: string
}

type SwapPhase =
  | { readonly kind: 'editing' }
  | { readonly kind: 'running'; readonly startedAt: number }
  | { readonly kind: 'done'; readonly result: HandSwapResult }
  | { readonly kind: 'failed' }

export type SwapTray = 'product' | 'resolution' | 'advanced'
type SwapView = 'compare' | 'result'

const startingRegion = (url: string) =>
  url === HAND_EXAMPLE.url ? HAND_EXAMPLE.region : STARTING_BOX

/** Hand product swap's page state. The run is `runHandSwap`, mocked for now. */
export function useHandProductSwap(locale: Locale = 'en') {
  const hand = shallowRef<SwapImage>()
  const ownProduct = shallowRef<SwapProduct>()
  const steps = shallowRef(
    history.historyOf<SwapSetup>({
      region: STARTING_BOX,
      productId: EXAMPLE_PRODUCTS[0].id
    })
  )
  const phase = shallowRef<SwapPhase>({ kind: 'editing' })
  const tray = ref<SwapTray>()
  const view = ref<SwapView>('compare')
  const drawing = ref(false)
  const resolution = ref<SwapResolution>('2K')
  const seed = ref(42)
  const owned = new Set<string>()
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const setup = computed(() => steps.value.present)
  const products = computed<readonly SwapProduct[]>(() =>
    ownProduct.value
      ? [...EXAMPLE_PRODUCTS, ownProduct.value]
      : EXAMPLE_PRODUCTS
  )
  const product = computed(
    () =>
      products.value.find(({ id }) => id === setup.value.productId) ??
      EXAMPLE_PRODUCTS[0]
  )
  const productName = computed(() =>
    product.value.label ? hc(product.value.label, locale) : product.value.name
  )
  const canRun = computed(
    () => Boolean(hand.value) && phase.value.kind !== 'running'
  )

  function leaveResult(next: SwapPhase) {
    const current = phase.value
    if (current.kind === 'done' && current.result.url.startsWith('blob:'))
      URL.revokeObjectURL(current.result.url)
    phase.value = next
  }

  function release(url: string | undefined) {
    if (!url || !owned.delete(url)) return
    URL.revokeObjectURL(url)
  }

  function reset(next: SwapImage) {
    run?.abort()
    leaveResult({ kind: 'editing' })
    const previous = hand.value?.url
    hand.value = next
    if (previous !== next.url) release(previous)
    steps.value = history.historyOf({
      region: startingRegion(next.url),
      productId: setup.value.productId
    })
    drawing.value = false
    view.value = 'compare'
  }

  function useExample() {
    pendingUrl = undefined
    const { url, name, width, height } = HAND_EXAMPLE
    reset({ url, name, width, height })
  }

  async function decode(file: File): Promise<SwapImage | undefined> {
    const url = URL.createObjectURL(file)
    pendingUrl = url
    const size = await imageSize(url)
    if (pendingUrl !== url || !size) {
      URL.revokeObjectURL(url)
      return undefined
    }
    pendingUrl = undefined
    owned.add(url)
    return { url, name: file.name, ...size }
  }

  async function useHandFile(file: File) {
    const next = await decode(file)
    if (next) reset(next)
  }

  async function useProductFile(file: File) {
    const next = await decode(file)
    if (!next) return
    release(ownProduct.value?.url)
    ownProduct.value = { ...next, id: OWN_PRODUCT_ID }
    steps.value = history.commit(steps.value, {
      ...setup.value,
      productId: OWN_PRODUCT_ID
    })
  }

  function pickProduct(productId: string) {
    if (productId === setup.value.productId) return
    steps.value = history.commit(steps.value, { ...setup.value, productId })
  }

  /** Call before a drag the visitor can undo as one step. */
  function checkpoint() {
    steps.value = history.checkpoint(steps.value)
  }

  function place(region: Rect) {
    steps.value = history.replace(steps.value, { ...setup.value, region })
  }

  function moveBox(region: Rect) {
    steps.value = history.commit(steps.value, { ...setup.value, region })
    drawing.value = false
  }

  function resetBox() {
    if (hand.value) moveBox(startingRegion(hand.value.url))
  }

  function undo() {
    steps.value = history.undo(steps.value)
  }

  function redo() {
    steps.value = history.redo(steps.value)
  }

  async function swap() {
    const current = hand.value
    if (!current || !canRun.value) return
    tray.value = undefined
    drawing.value = false
    const controller = new AbortController()
    run = controller
    leaveResult({ kind: 'running', startedAt: Date.now() })
    try {
      const result = await runHandSwap(
        swapRequest({
          hand: current,
          productUrl: product.value.url,
          region: setup.value.region,
          resolution: resolution.value,
          seed: seed.value
        }),
        controller.signal
      )
      if (run === controller) {
        view.value = 'compare'
        phase.value = { kind: 'done', result }
      }
    } catch {
      if (run === controller && !controller.signal.aborted)
        phase.value = { kind: 'failed' }
    }
  }

  function cancel() {
    run?.abort()
    phase.value = { kind: 'editing' }
  }

  function edit() {
    leaveResult({ kind: 'editing' })
  }

  function toggleTray(next: SwapTray) {
    tray.value = tray.value === next ? undefined : next
  }

  tryOnScopeDispose(() => {
    run?.abort()
    pendingUrl = undefined
    leaveResult({ kind: 'editing' })
    owned.forEach((url) => URL.revokeObjectURL(url))
    owned.clear()
  })

  return {
    hand,
    products,
    product,
    productName,
    setup,
    phase,
    tray,
    view,
    drawing,
    resolution,
    seed,
    canRun,
    canUndo: computed(() => steps.value.past.length > 0),
    canRedo: computed(() => steps.value.future.length > 0),
    useExample,
    useHandFile,
    useProductFile,
    pickProduct,
    checkpoint,
    place,
    moveBox,
    resetBox,
    undo,
    redo,
    swap,
    cancel,
    edit,
    toggleTray
  }
}

export type HandProductSwap = ReturnType<typeof useHandProductSwap>

import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type {
  HandSwapResult,
  SwapProgress,
  SwapResolution
} from '@/lib/workshop/hand-product-swap/contract'
import { hc } from '@/lib/workshop/hand-product-swap/copy'
import type {
  SwapImage,
  SwapProduct
} from '@/lib/workshop/hand-product-swap/examples'
import {
  EXAMPLE_PRODUCTS,
  HAND_EXAMPLE,
  OWN_PRODUCT_ID
} from '@/lib/workshop/hand-product-swap/examples'
import * as history from '@/lib/workshop/hand-product-swap/history'
import { runHandSwap } from '@/lib/workshop/hand-product-swap/mock-run'
import { imageSize } from '@/lib/workshop/image-size'

/** Everything undo and redo cover. */
interface SwapSetup {
  readonly productId: string
  readonly resolution: SwapResolution
}

type SwapPhase =
  | { readonly kind: 'editing' }
  | {
      readonly kind: 'running'
      readonly startedAt: number
      readonly progress: SwapProgress
    }
  | { readonly kind: 'done'; readonly result: HandSwapResult }
  | { readonly kind: 'failed' }

export type SwapTray = 'product' | 'resolution' | 'seed'

/** Hand product swap's page state. The run is `runHandSwap`, mocked for now. */
export function useHandProductSwap(locale: Locale = 'en') {
  const hand = shallowRef<SwapImage>()
  const ownProduct = shallowRef<SwapProduct>()
  const steps = shallowRef(
    history.historyOf<SwapSetup>({
      productId: EXAMPLE_PRODUCTS[0].id,
      resolution: '2K'
    })
  )
  const phase = shallowRef<SwapPhase>({ kind: 'editing' })
  const tray = ref<SwapTray>()
  const comparing = ref(false)
  const seed = ref(42)
  const owned = new Set<string>()
  let pendingUrl: string | undefined
  let run: AbortController | undefined

  const setup = computed(() => steps.value.present)
  const resolution = computed({
    get: () => setup.value.resolution,
    set: (next: SwapResolution) => {
      if (next !== setup.value.resolution)
        steps.value = history.commit(steps.value, {
          ...setup.value,
          resolution: next
        })
    }
  })
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
  const running = computed(() => phase.value.kind === 'running')
  const canRun = computed(() => Boolean(hand.value) && !running.value)

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
    steps.value = history.historyOf(setup.value)
    comparing.value = false
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
    if (running.value) return
    const next = await decode(file)
    if (next) reset(next)
  }

  async function useProductFile(file: File) {
    if (running.value) return
    const next = await decode(file)
    if (!next) return
    leaveResult({ kind: 'editing' })
    release(ownProduct.value?.url)
    ownProduct.value = { ...next, id: OWN_PRODUCT_ID }
    steps.value = history.commit(steps.value, {
      ...setup.value,
      productId: OWN_PRODUCT_ID
    })
  }

  /** A pasted image is the hand photo until there is one, then the product. */
  function usePastedFile(file: File) {
    return hand.value ? useProductFile(file) : useHandFile(file)
  }

  function pickProduct(productId: string) {
    if (productId === setup.value.productId) return
    steps.value = history.commit(steps.value, { ...setup.value, productId })
  }

  function undo() {
    steps.value = history.undo(steps.value)
  }

  function redo() {
    steps.value = history.redo(steps.value)
  }

  function report(controller: AbortController, progress: SwapProgress) {
    const current = phase.value
    if (run === controller && current.kind === 'running')
      phase.value = { ...current, progress }
  }

  async function swap() {
    const current = hand.value
    if (!current || !canRun.value) return
    tray.value = undefined
    const controller = new AbortController()
    run = controller
    leaveResult({
      kind: 'running',
      startedAt: Date.now(),
      progress: { kind: 'queued' }
    })
    try {
      const result = await runHandSwap(
        {
          hand: current.url,
          product: product.value.url,
          resolution: setup.value.resolution,
          seed: seed.value
        },
        controller.signal,
        (progress) => report(controller, progress)
      )
      if (run === controller) {
        comparing.value = false
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
    comparing,
    resolution,
    seed,
    canRun,
    canUndo: computed(() => steps.value.past.length > 0),
    canRedo: computed(() => steps.value.future.length > 0),
    useExample,
    useHandFile,
    useProductFile,
    usePastedFile,
    pickProduct,
    undo,
    redo,
    swap,
    cancel,
    edit,
    toggleTray
  }
}

export type HandProductSwap = ReturnType<typeof useHandProductSwap>

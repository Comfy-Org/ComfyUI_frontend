<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'
import DownloadLocalButton from './DownloadLocalButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const svgRef = ref<SVGSVGElement>()
let animationId: number | null = null

onMounted(() => {
  const svg = svgRef.value
  if (!svg) return

  const panels = [
    svg.querySelector('[data-panel="1"]') as SVGRectElement,
    svg.querySelector('[data-panel="2"]') as SVGRectElement,
    svg.querySelector('[data-panel="3"]') as SVGRectElement
  ]
  const panelAnchor = svg.querySelector('[data-panel-anchor]') as SVGElement

  const S = { tx: 675.746, ty: 878.068, w: 371.886, h: 371.888, rx: 59.4123 }
  const E = {
    tx: 426.129,
    ty: 1117.49,
    w: 491.85,
    h: 491.852,
    rx: 65.5036
  }
  const PANEL_DURATION = 2200

  const HEX_MOVE_DUR = 900
  const HEX_HOLD_DUR = 300
  const HEX_STEP_DUR = HEX_MOVE_DUR + HEX_HOLD_DUR

  const hexYellow = svg.querySelector(
    '[data-hex="yellow"]'
  ) as SVGGraphicsElement
  const hexKeys = ['5', '6', '7', '8', '11', '12', '13', '14']

  const yb = hexYellow.getBBox()
  const ycx = yb.x + yb.width / 2
  const ycy = yb.y + yb.height / 2

  const raw = hexKeys.map((key) => {
    const el = svg.querySelector(`[data-hex="${key}"]`) as SVGGraphicsElement
    const bb = el.getBBox()
    const dx = bb.x + bb.width / 2 - ycx
    const dy = bb.y + bb.height / 2 - ycy
    return { el, dx, dy, angle: Math.atan2(dy, dx) }
  })

  raw.sort((a, b) => {
    const norm = (v: number) => {
      const r = v + Math.PI / 2
      return r < 0 ? r + 2 * Math.PI : r
    }
    return norm(a.angle) - norm(b.angle)
  })

  const hexSlots = raw.map((h) => ({ dx: h.dx, dy: h.dy }))
  const hexRing = raw.map((h, i) => ({
    el: h.el,
    origDx: h.dx,
    origDy: h.dy,
    slot: i
  }))

  function ease(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
  }

  function applyToPanel(el: SVGRectElement, elapsed: number) {
    const progress = elapsed < PANEL_DURATION ? elapsed / PANEL_DURATION : 1
    const t = ease(progress)
    const tx = lerp(S.tx, E.tx, t)
    const ty = lerp(S.ty, E.ty, t)
    const w = lerp(S.w, E.w, t)
    const h = lerp(S.h, E.h, t)
    const rx = lerp(S.rx, E.rx, t)
    const opacity = t < 0.95 ? 1 : 1 - (t - 0.95) / 0.05

    el.setAttribute('width', String(w))
    el.setAttribute('height', String(h))
    el.setAttribute('rx', String(rx))
    el.setAttribute('transform', `matrix(-0.866025 -0.5 0 -1 ${tx} ${ty})`)
    el.setAttribute('opacity', String(opacity))
  }

  let startTime: number | null = null

  function tick(timestamp: number) {
    if (!startTime) startTime = timestamp

    const base = timestamp - startTime
    const PANEL_CYCLE = HEX_STEP_DUR * 3
    const START_OFFSET = HEX_MOVE_DUR

    const elapsed1 = (base - START_OFFSET + PANEL_CYCLE * 10) % PANEL_CYCLE
    const elapsed2 =
      (base - START_OFFSET - HEX_STEP_DUR + PANEL_CYCLE * 10) % PANEL_CYCLE
    const elapsed3 =
      (base - START_OFFSET - HEX_STEP_DUR * 2 + PANEL_CYCLE * 10) % PANEL_CYCLE

    applyToPanel(panels[0], elapsed1)
    applyToPanel(panels[1], elapsed2)
    applyToPanel(panels[2], elapsed3)

    const wOf = (elapsed: number) => {
      const progress = elapsed < PANEL_DURATION ? elapsed / PANEL_DURATION : 1
      return lerp(S.w, E.w, ease(progress))
    }
    const sorted = [
      { el: panels[0], w: wOf(elapsed1) },
      { el: panels[1], w: wOf(elapsed2) },
      { el: panels[2], w: wOf(elapsed3) }
    ].sort((a, b) => a.w - b.w)
    const parent = panels[0].parentNode!
    sorted.forEach((p) => parent.insertBefore(p.el, panelAnchor.nextSibling))

    const N = hexSlots.length
    const stepNum = Math.floor(base / HEX_STEP_DUR)
    const stepMs = base % HEX_STEP_DUR
    const ht = stepMs < HEX_MOVE_DUR ? ease(stepMs / HEX_MOVE_DUR) : 1

    hexRing.forEach((h) => {
      const from = hexSlots[(h.slot + stepNum) % N]
      const to = hexSlots[(h.slot + stepNum + 1) % N]
      const curDx = from.dx + (to.dx - from.dx) * ht
      const curDy = from.dy + (to.dy - from.dy) * ht
      h.el.setAttribute(
        'transform',
        `translate(${curDx - h.origDx}, ${curDy - h.origDy})`
      )
    })

    animationId = requestAnimationFrame(tick)
  }

  animationId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<template>
  <section
    class="max-w-9xl relative mx-auto flex flex-col items-center overflow-hidden lg:flex-row lg:items-center lg:overflow-x-visible lg:overflow-y-clip lg:pb-[min(15vw,25rem)]"
  >
    <!-- Illustration (stacks above on mobile, left on lg) -->
    <div
      class="aspect-square w-4/5 max-w-md scale-150 self-center md:max-w-2xl lg:pointer-events-none lg:z-1 lg:-mr-12 lg:translate-x-[10%] lg:translate-y-[150px] lg:self-center xl:size-[clamp(42rem,max(50vh,40vw),44rem)] xl:min-h-[min(40vw,32rem)] xl:min-w-[min(30vw,24rem)]"
    >
      <svg
        ref="svgRef"
        class="block size-full overflow-visible"
        viewBox="400 200 550 800"
        fill="none"
        aria-hidden="true"
      >
        <!-- Animated panels (isometric expanding rects) -->
        <rect
          data-panel-anchor
          x="-1.29904"
          y="-2.25"
          width="491.85"
          height="491.852"
          rx="65.5036"
          transform="matrix(-0.866025 -0.5 0 -1 620.969 1058.01)"
          fill="#211927"
          stroke="#7E7C78"
          stroke-width="3"
          visibility="hidden"
        />
        <rect
          data-panel="1"
          x="-1.29904"
          y="-2.25"
          width="371.886"
          height="371.888"
          rx="59.4123"
          transform="matrix(-0.866025 -0.5 0 -1 675.746 878.068)"
          fill="#211927"
          stroke="#7E7C78"
          stroke-width="3"
        />
        <rect
          data-panel="2"
          x="-1.29904"
          y="-2.25"
          width="371.886"
          height="371.888"
          rx="59.4123"
          transform="matrix(-0.866025 -0.5 0 -1 675.746 878.068)"
          fill="#211927"
          stroke="#7E7C78"
          stroke-width="3"
        />
        <rect
          data-panel="3"
          x="-1.29904"
          y="-2.25"
          width="371.886"
          height="371.888"
          rx="59.4123"
          transform="matrix(-0.866025 -0.5 0 -1 675.746 878.068)"
          fill="#211927"
          stroke="#7E7C78"
          stroke-width="3"
        />

        <!-- Hex nodes -->
        <g stroke="#7E7C78" stroke-width="6">
          <path
            data-hex="5"
            d="M722.595 427.826L722.579 491.728C722.576 500.223 728.536 510.551 735.889 514.796L791.205 546.733C795.862 549.422 804.238 549.298 808.894 546.607L864.227 514.642C871.583 510.392 877.548 500.061 877.55 491.566L877.567 427.664C877.568 422.286 873.487 414.972 868.829 412.283L813.514 380.347C806.16 376.101 794.236 376.104 786.88 380.354L731.548 412.319C726.882 415.015 722.597 422.437 722.595 427.826Z"
            fill="#211927"
          />
          <path
            data-hex="6"
            d="M876.952 605.157L876.968 541.255C876.971 532.76 871.011 522.432 863.658 518.187L808.342 486.25C803.684 483.561 795.309 483.685 790.652 486.376L735.32 518.341C727.964 522.591 721.999 532.922 721.997 541.417L721.98 605.319C721.979 610.697 726.06 618.011 730.717 620.7L786.033 652.636C793.387 656.882 805.311 656.879 812.666 652.629L867.999 620.664C872.665 617.968 876.95 610.546 876.952 605.157Z"
            fill="#37303F"
          />
          <path
            data-hex="7"
            d="M716.009 326.397L771.358 358.333C778.716 362.579 784.681 372.904 784.681 381.395L784.681 445.268C784.681 450.646 780.385 457.837 775.727 460.525L720.378 492.461C713.02 496.707 701.09 496.707 693.732 492.461L638.383 460.525C633.725 457.837 629.432 450.646 629.432 445.268L629.432 381.395C629.432 372.904 635.396 362.579 642.754 358.333L698.104 326.397C702.771 323.704 711.341 323.704 716.009 326.397Z"
            fill="#251D2B"
          />
          <path
            data-hex="8"
            d="M622.345 438.145L677.694 406.209C685.052 401.963 691.017 391.638 691.017 383.147L691.017 319.274C691.017 313.896 686.721 306.705 682.063 304.017L626.714 272.081C619.356 267.835 607.426 267.835 600.068 272.081L544.719 304.017C540.061 306.705 535.768 313.896 535.768 319.274L535.768 383.147C535.768 391.638 541.732 401.963 549.09 406.209L604.439 438.145C609.107 440.838 617.677 440.838 622.345 438.145Z"
            fill="#211927"
          />
          <path
            data-hex="yellow"
            d="M715.349 599.238L770.698 567.302C778.056 563.056 784.021 552.731 784.021 544.24L784.021 480.367C784.021 474.989 779.725 467.798 775.067 465.11L719.718 433.173C712.36 428.928 700.43 428.928 693.072 433.173L637.723 465.11C633.065 467.798 628.771 474.989 628.771 480.367L628.771 544.24C628.771 552.731 634.736 563.056 642.094 567.302L697.443 599.238C702.111 601.931 710.681 601.931 715.349 599.238Z"
            fill="#F2FF59"
          />
          <path
            data-hex="11"
            d="M622.919 547.369L678.268 515.432C685.626 511.187 691.591 500.862 691.591 492.371L691.591 428.497C691.591 423.119 687.296 415.928 682.637 413.241L627.288 381.304C619.93 377.058 608 377.058 600.643 381.304L545.293 413.24C540.635 415.928 536.342 423.119 536.342 428.497L536.342 492.371C536.342 500.862 542.307 511.187 549.665 515.432L605.014 547.369C609.681 550.062 618.252 550.062 622.919 547.369Z"
            fill="#37303F"
          />
          <path
            data-hex="12"
            d="M733.341 630.398L788.673 598.432C796.029 594.183 807.953 594.179 815.306 598.425L870.622 630.361C875.28 633.051 879.359 640.366 879.358 645.744L879.341 709.646C879.339 718.141 873.374 728.472 866.019 732.722L810.686 764.688C806.029 767.378 797.655 767.5 792.997 764.811L737.682 732.875C730.328 728.629 724.369 718.301 724.371 709.806L724.388 645.904C724.389 640.515 728.675 633.093 733.341 630.398Z"
            fill="#211927"
          />
          <path
            data-hex="13"
            d="M639.04 575.288L694.372 543.323C701.728 539.074 713.652 539.07 721.005 543.316L776.321 575.252C780.979 577.942 785.059 585.257 785.057 590.635L785.04 654.537C785.038 663.032 779.073 673.363 771.718 677.613L716.385 709.579C711.728 712.269 703.354 712.391 698.697 709.702L643.381 677.766C636.027 673.52 630.068 663.192 630.07 654.697L630.087 590.795C630.089 585.406 634.374 577.984 639.04 575.288Z"
            fill="#251D2B"
          />
          <path
            data-hex="14"
            d="M545.368 519.81L600.7 487.844C608.056 483.595 619.98 483.591 627.334 487.837L682.649 519.774C687.307 522.463 691.387 529.778 691.385 535.156L691.369 599.059C691.366 607.553 685.402 617.885 678.046 622.134L622.713 654.1C618.057 656.79 609.682 656.912 605.025 654.223L549.709 622.287C542.355 618.041 536.396 607.713 536.399 599.218L536.415 535.316C536.417 529.927 540.702 522.505 545.368 519.81Z"
            fill="#211927"
          />
        </g>

        <!-- Left-edge fade -->
        <rect
          x="300"
          y="150"
          width="250"
          height="900"
          fill="url(#localHeroFade)"
        />
        <defs>
          <linearGradient
            id="localHeroFade"
            x1="550"
            y1="600"
            x2="300"
            y2="600"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#211927" stop-opacity="0" />
            <stop offset="1" stop-color="#211927" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- Text -->
    <div
      class="relative z-10 mt-17 w-full px-4 pb-16 lg:mt-0 lg:min-w-160 lg:flex-1 lg:translate-x-[10%] lg:px-20 lg:py-24"
    >
      <ProductHeroBadge />

      <h1
        class="text-primary-comfy-canvas mt-8 text-4xl/tight font-light whitespace-pre-line md:text-5xl/tight lg:max-w-2xl lg:text-6xl/tight"
      >
        {{ t('download.hero.heading', locale) }}
      </h1>

      <p
        class="text-primary-comfy-canvas mt-8 max-w-md text-sm lg:mt-10 lg:text-base"
      >
        {{ t('download.hero.subtitle', locale) }}
      </p>

      <div class="mt-10 flex flex-col gap-4 lg:flex-row">
        <DownloadLocalButton :locale class-name="lg:min-w-60" />
        <BrandButton
          :href="externalLinks.github"
          variant="outline"
          size="lg"
          class-name="flex items-center justify-center gap-2 lg:min-w-60"
        >
          <span
            class="icon-mask size-5 mask-[url('/icons/social/github.svg')]"
            aria-hidden="true"
          />
          {{ t('download.hero.installGithub', locale) }}
        </BrandButton>
      </div>
    </div>
  </section>
</template>

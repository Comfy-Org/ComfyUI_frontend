<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import type { Locale } from '../../../i18n/translations'

import { prefersReducedMotion } from '../../../composables/useReducedMotion'
import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const canvasRef = ref<HTMLCanvasElement>()
let animationId: number | null = null

onMounted(() => {
  const canvas = canvasRef.value!
  const ctx = canvas.getContext('2d')!

  const path1 = new Path2D(
    'M686.495 69.9406C690.817 69.9406 695.056 70.8239 697.978 72.5099L772.061 115.256C776.797 117.989 781.141 122.719 784.303 128.193C787.466 133.667 789.392 139.792 789.392 145.257V230.748C789.392 234.111 788.038 238.14 785.878 241.801C783.718 245.46 780.832 248.616 777.909 250.303L703.826 293.049C699.09 295.782 692.818 297.177 686.493 297.177C680.168 297.177 673.897 295.782 669.161 293.049L595.078 250.303C592.155 248.616 589.27 245.46 587.111 241.801C584.951 238.14 583.597 234.111 583.597 230.748V145.257L583.603 144.742C583.719 139.409 585.623 133.495 588.686 128.193C591.849 122.719 596.193 117.989 600.929 115.256L675.011 72.5099C677.933 70.8239 682.173 69.9406 686.495 69.9406Z'
  )
  const path2 = new Path2D(
    'M814.495 141.941C818.817 141.941 823.056 142.824 825.978 144.51L900.061 187.256C904.797 189.989 909.141 194.719 912.303 200.193C915.466 205.667 917.392 211.792 917.392 217.257V302.748C917.392 306.111 916.038 310.14 913.878 313.801C911.718 317.46 908.832 320.616 905.909 322.303L831.826 365.049C827.09 367.782 820.818 369.177 814.493 369.177C808.168 369.177 801.897 367.782 797.161 365.049L723.078 322.303C720.155 320.616 717.27 317.46 715.111 313.801C712.951 310.14 711.597 306.111 711.597 302.748V217.257L711.603 216.742C711.719 211.409 713.623 205.495 716.686 200.193C719.849 194.719 724.193 189.989 728.929 187.256L803.011 144.51C805.933 142.824 810.173 141.941 814.495 141.941Z'
  )
  const path3 = new Path2D(
    'M934.495 214.381C938.77 214.381 942.925 215.257 945.759 216.892L1019.84 259.637C1024.49 262.322 1028.79 266.988 1031.92 272.412C1035.06 277.837 1036.95 283.887 1036.95 289.257V374.748C1036.95 378.007 1035.63 381.958 1033.5 385.577C1031.36 389.194 1028.53 392.284 1025.69 393.922L951.605 436.668C946.951 439.353 940.761 440.737 934.493 440.737C928.225 440.737 922.035 439.353 917.382 436.668L843.299 393.922C840.461 392.285 837.624 389.194 835.49 385.577C833.355 381.958 832.038 378.007 832.038 374.748V289.257C832.038 283.887 833.933 277.837 837.067 272.412C840.201 266.988 844.496 262.322 849.149 259.637L923.232 216.892C926.065 215.257 930.22 214.381 934.495 214.381Z'
  )
  const path4 = new Path2D(
    'M1156.84 418.282L1208.28 447.966C1215.12 451.912 1220.67 461.509 1220.67 469.401V528.771C1220.67 533.77 1216.67 540.454 1212.34 542.952L1160.9 572.637C1154.06 576.583 1142.97 576.583 1136.13 572.637L1084.68 542.952C1080.35 540.454 1076.36 533.77 1076.36 528.771V469.401C1076.36 461.509 1081.91 451.912 1088.75 447.966L1140.19 418.282C1144.53 415.778 1152.5 415.778 1156.84 418.282Z'
  )

  const elementLayers: Array<(c: CanvasRenderingContext2D) => void> = [
    (c) => {
      c.fillStyle = '#211927'
      c.strokeStyle = '#49378B'
      c.lineWidth = 2
      c.fill(path1)
      c.stroke(path1)
    },
    (c) => {
      c.fillStyle = '#251D2B'
      c.strokeStyle = '#49378B'
      c.lineWidth = 2
      c.fill(path2)
      c.stroke(path2)
    },
    (c) => {
      c.fillStyle = '#37303F'
      c.strokeStyle = '#49378B'
      c.lineWidth = 2.88
      c.fill(path3)
      c.stroke(path3)
    },
    (c) => {
      c.save()
      c.transform(3.69127e-8, 1, -0.866025, 0.5, 1195.48, 143.45)
      c.fillStyle = '#211927'
      c.strokeStyle = '#49378B'
      c.lineWidth = 2
      c.beginPath()
      if (c.roundRect) c.roundRect(-0.866025, 1.5, 341.2, 341.2, 53.8242)
      else c.rect(-0.866025, 1.5, 341.2, 341.2)
      c.fill()
      c.stroke()
      c.restore()
    },
    (c) => {
      c.fillStyle = '#F2FF59'
      c.fill(path4)
    }
  ]

  function drawOutfeedPanel(c: CanvasRenderingContext2D, scaleAmt: number) {
    c.save()
    c.transform(3.69127e-8, 1, -0.866025, 0.5, 1455.63, 304.982)
    c.translate(170.6, 170.6)
    c.scale(scaleAmt, scaleAmt)
    c.translate(-170.6, -170.6)
    c.fillStyle = '#211927'
    c.strokeStyle = '#49378B'
    c.beginPath()
    if (c.roundRect) c.roundRect(-0.866025, 1.5, 341.2, 341.2, 53.8242)
    else c.rect(-0.866025, 1.5, 341.2, 341.2)
    c.fill()
    c.stroke()
    c.restore()
  }

  const isoAngle = Math.atan2(72.44, 120)

  function drawLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#211927'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(-150, 0)

    ctx.save()
    ctx.transform(-1, 0, 0, 1, 1516, 112)
    ctx.fillStyle = '#211927'
    ctx.fillRect(0, 0, 800, 800)
    ctx.restore()

    const time = Date.now() / 1000
    const cycle = time % 1.0

    let stampAmt = 0
    let conveyorEject = 0

    if (cycle < 0.35) {
      const p = cycle / 0.35
      stampAmt = Math.pow(Math.sin(p * Math.PI), 1.2)
      conveyorEject = 0
    } else {
      const p = (cycle - 0.35) / 0.65
      conveyorEject = (1 - Math.cos(p * Math.PI)) / 2
      stampAmt = 0
    }

    const maxPushDistance = 210
    const travelMagnitude = stampAmt * maxPushDistance
    const halfPush = travelMagnitude / 2

    const pin_tx = Math.cos(isoAngle) * halfPush
    const pin_ty = Math.sin(isoAngle) * halfPush
    const outfeed_tx = -Math.cos(isoAngle) * halfPush
    const outfeed_ty = -Math.sin(isoAngle) * halfPush

    for (let index = 0; index <= 4; index++) {
      ctx.save()
      if (index === 4) {
        elementLayers[index](ctx)
      } else {
        ctx.translate(pin_tx, pin_ty)
        elementLayers[index](ctx)
      }
      ctx.restore()
    }

    ctx.save()
    ctx.translate(outfeed_tx, outfeed_ty)
    drawOutfeedPanel(ctx, 1.0)
    ctx.restore()

    const outFeedDx = 86.85
    const outFeedDy = 116.62

    for (let i = 0; i <= 3; i++) {
      const slideOffset = i + conveyorEject
      if (slideOffset <= 0.01) continue

      let opacity = 1
      if (slideOffset > 2.0) {
        opacity = Math.max(0, 1 - (slideOffset - 2.0) / 1.5)
      }
      if (opacity <= 0.01) continue

      const scaleAmt = Math.max(0, 1.0 - slideOffset * 0.15)

      ctx.save()
      ctx.translate(
        slideOffset * outFeedDx + outfeed_tx,
        slideOffset * outFeedDy + outfeed_ty
      )
      ctx.globalAlpha = opacity
      ctx.lineWidth = 1.0 + Math.pow(opacity, 0.5)
      drawOutfeedPanel(ctx, scaleAmt)
      ctx.restore()
    }

    ctx.restore()

    if (!prefersReducedMotion()) {
      animationId = requestAnimationFrame(drawLoop)
    }
  }

  drawLoop()
})

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<template>
  <section
    class="max-w-9xl relative mx-auto flex flex-col items-center overflow-hidden lg:flex-row-reverse lg:items-center lg:overflow-x-visible lg:overflow-y-clip lg:pb-[min(15vw,25rem)]"
  >
    <!-- Illustration (stacks above on mobile, right on lg) -->
    <div
      class="w-4/5 max-w-md scale-150 self-center md:max-w-2xl lg:pointer-events-none lg:z-1 lg:-ml-12 lg:-translate-x-[10%] lg:translate-y-[100px] lg:self-center xl:size-[clamp(42rem,max(50vh,40vw),44rem)] xl:min-h-[min(40vw,32rem)] xl:min-w-[min(30vw,24rem)]"
    >
      <canvas
        ref="canvasRef"
        class="block w-full"
        width="1619"
        height="1024"
        aria-hidden="true"
      />
    </div>

    <!-- Text -->
    <div
      class="relative z-10 w-full px-4 pb-16 lg:min-w-160 lg:flex-1 lg:translate-x-[10%] lg:px-20 lg:py-24"
    >
      <ProductHeroBadge text="API" />

      <h1
        class="text-primary-comfy-canvas mt-8 text-4xl/tight font-light whitespace-pre-line md:text-5xl/tight lg:max-w-2xl lg:text-6xl/tight"
      >
        {{ t('api.hero.heading', locale) }}
      </h1>

      <p
        class="text-primary-comfy-canvas mt-8 max-w-md text-sm lg:mt-10 lg:text-base"
      >
        {{ t('api.hero.subtitle', locale) }}
      </p>

      <div class="mt-10 flex flex-col gap-4 lg:flex-row">
        <BrandButton
          :href="externalLinks.cloud"
          :label="t('api.hero.getApiKeys', locale)"
          size="lg"
          class-name="text-center lg:min-w-60"
        />
        <BrandButton
          :href="externalLinks.docs"
          :label="t('api.hero.viewDocs', locale)"
          variant="outline"
          size="lg"
          class-name="text-center lg:min-w-60"
        />
      </div>
    </div>
  </section>
</template>

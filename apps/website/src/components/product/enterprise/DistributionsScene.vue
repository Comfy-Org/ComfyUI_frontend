<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { prefersReducedMotion } from '../../../composables/useReducedMotion'

// Scene ported from Comfy-Org/comfy-website-animations distributions.html.
// The source pillar outlines shipped as ~95KB degenerate paths (thousands of
// micro-curves along straight edges); they are simplified here to equivalent
// ~450B polygons.

const RING_D =
  'M400 285.274C414.877 285.274 429.684 288.556 440.919 295.042L638.843 409.313C650.085 415.804 655.411 424.129 655.411 432.187C655.411 440.246 650.085 448.571 638.843 455.062L440.919 569.333C429.684 575.819 414.877 579.1 400 579.1C385.123 579.1 370.316 575.819 359.081 569.333L161.156 455.062C149.914 448.571 144.588 440.246 144.588 432.188C144.588 424.129 149.914 415.804 161.156 409.313L359.081 295.042C370.316 288.556 385.123 285.274 400 285.274Z'

type Cube = {
  id: string
  bodyD: string
  capD: string
  fills: string[]
}

const cubes: Cube[] = [
  {
    id: 'c1',
    bodyD:
      'M389.6 186.8L392.3 185.6L395.2 184.8L398.4 184.4L401.6 184.4L404.8 184.8L407.7 185.6L410.4 186.8L459.9 215.4L461.0 216.2L462.8 217.8L463.8 219.6L464.2 221.5L464.2 395.1L463.8 396.9L462.8 398.7L462.0 399.6L459.9 401.1L410.4 429.7L407.7 430.9L404.8 431.7L401.6 432.1L398.4 432.1L395.2 431.7L392.3 430.9L389.6 429.7L340.1 401.1L339.0 400.4L337.2 398.7L336.2 396.9L335.8 395.1L335.9 220.5L336.6 218.7L337.2 217.8L339.0 216.2L340.1 215.4Z',
    capD: 'M340.127 227.416C334.387 224.103 334.387 218.73 340.127 215.416L389.608 186.849C395.347 183.535 404.653 183.535 410.393 186.849L459.874 215.416C465.613 218.73 465.613 224.103 459.874 227.416L410.393 255.984C404.653 259.298 395.347 259.298 389.608 255.984L340.127 227.416Z',
    fills: ['url(#mbdist-p0)', 'url(#mbdist-p1)', 'url(#mbdist-p2)']
  },
  {
    id: 'c2',
    bodyD:
      'M453.8 270.5L456.4 269.2L459.4 268.4L462.6 268.0L465.8 268.0L468.9 268.4L471.9 269.2L474.6 270.5L524.1 299.0L525.2 299.8L527.0 301.4L528.0 303.2L528.4 305.1L528.4 430.7L528.0 432.6L527.0 434.3L526.2 435.2L524.1 436.7L474.6 465.3L471.9 466.5L468.9 467.3L465.8 467.7L462.6 467.7L459.4 467.3L456.4 466.5L453.8 465.3L404.3 436.7L403.2 436.0L401.4 434.3L400.3 432.6L400.0 430.7L400.0 305.1L400.3 303.2L401.4 301.4L402.2 300.6L404.3 299.0Z',
    capD: 'M404.305 311.028C398.565 307.714 398.565 302.341 404.305 299.028L453.786 270.46C459.525 267.146 468.831 267.146 474.57 270.46L524.051 299.028C529.791 302.341 529.791 307.714 524.051 311.028L474.57 339.596C468.831 342.909 459.525 342.909 453.786 339.596L404.305 311.028Z',
    fills: ['url(#mbdist-p2)']
  },
  {
    id: 'c3',
    bodyD:
      'M325.4 307.5L328.1 306.2L331.1 305.4L334.2 305.0L337.4 305.0L340.6 305.4L343.6 306.2L346.2 307.5L395.7 336.0L396.8 336.8L398.6 338.4L399.7 340.2L400.0 342.1L400.0 430.7L399.9 431.6L399.2 433.5L397.8 435.2L395.7 436.7L346.2 465.3L343.6 466.5L340.6 467.3L337.4 467.7L334.2 467.7L331.1 467.3L328.1 466.5L325.4 465.3L275.9 436.7L274.8 436.0L273.0 434.3L272.0 432.6L271.6 430.7L271.6 342.1L272.0 340.2L273.0 338.4L273.8 337.6L275.9 336.0Z',
    capD: 'M275.948 348.028C270.209 344.714 270.209 339.341 275.948 336.028L325.429 307.46C331.169 304.146 340.474 304.146 346.214 307.46L395.695 336.028C401.434 339.341 401.434 344.714 395.695 348.028L346.214 376.596C340.474 379.909 331.169 379.909 325.429 376.596L275.948 348.028Z',
    fills: ['url(#mbdist-p4)', 'url(#mbdist-p5)', 'url(#mbdist-p2)']
  },
  {
    id: 'c4',
    bodyD:
      'M389.6 386.1L392.3 384.9L395.2 384.0L398.4 383.6L401.6 383.6L404.8 384.0L407.7 384.9L410.4 386.1L459.9 414.6L462.0 416.2L463.4 417.9L463.8 418.8L464.2 420.7L464.2 466.3L463.8 468.2L462.8 470.0L461.0 471.6L459.9 472.4L410.4 500.9L407.7 502.1L404.8 503.0L401.6 503.4L398.4 503.4L395.2 503.0L392.3 502.1L389.6 500.9L340.1 472.4L339.0 471.6L337.2 470.0L336.6 469.1L335.9 467.2L335.8 420.7L335.9 419.8L336.6 417.9L338.0 416.2L340.1 414.6Z',
    capD: 'M340.127 426.637C334.387 423.323 334.387 417.951 340.127 414.637L389.608 386.069C395.347 382.756 404.653 382.756 410.393 386.069L459.874 414.637C465.613 417.951 465.613 423.323 459.874 426.637L410.393 455.205C404.653 458.519 395.347 458.519 389.608 455.205L340.127 426.637Z',
    fills: ['url(#mbdist-p7)', 'url(#mbdist-p8)', 'url(#mbdist-p2)']
  }
]

const svgRef = ref<SVGSVGElement>()
let animationId: number | null = null

onMounted(() => {
  const svg = svgRef.value
  if (!svg || prefersReducedMotion()) return

  // Pillars grow up and down from their base. The textured body is static —
  // the clip translates down (anchored at the pillar's bottom) and the yellow
  // cap rides the moving top edge, so the texture stays held in place.
  const DEPTH = 0.3
  const SPD = 1.7
  const parts = [...svg.querySelectorAll<SVGGElement>('.mbdist-cube')].map(
    (g, i) => {
      const body = g.querySelector<SVGGElement>('.mbdist-body')!
      const bb = body.getBBox()
      return {
        clip: g.querySelector<SVGPathElement>('.mbdist-clip')!,
        cap: g.querySelector<SVGPathElement>('.mbdist-cap')!,
        T: bb.y,
        B: bb.y + bb.height,
        phase: (i * Math.PI) / 2
      }
    }
  )

  let t0: number | null = null
  const tick = (ts: number) => {
    if (t0 === null) t0 = ts
    const t = (ts - t0) / 1000
    for (const c of parts) {
      const dy = DEPTH * (c.B - c.T) * (0.5 + 0.5 * Math.sin(SPD * t - c.phase))
      const transform = `translate(0 ${dy.toFixed(2)})`
      c.clip.setAttribute('transform', transform)
      c.cap.setAttribute('transform', transform)
    }
    animationId = requestAnimationFrame(tick)
  }
  animationId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId)
})
</script>

<template>
  <svg
    ref="svgRef"
    class="block aspect-800/580 w-full"
    viewBox="0 150 800 580"
    fill="none"
    aria-hidden="true"
  >
    <path
      v-for="echoClass in [
        'mbdist-echo mbdist-e0',
        'mbdist-echo mbdist-e1',
        'mbdist-echo mbdist-e2'
      ]"
      :key="echoClass"
      :class="echoClass"
      :d="RING_D"
      fill="none"
      stroke="#49378B"
      stroke-width="2.6"
    />
    <path
      class="mbdist-platform"
      :d="RING_D"
      fill="#211927"
      stroke="#49378B"
      stroke-width="2.6"
    />

    <g v-for="cube in cubes" :key="cube.id" class="mbdist-cube">
      <clipPath :id="`mbdist-clip-${cube.id}`">
        <path class="mbdist-clip" :d="cube.bodyD" />
      </clipPath>
      <g class="mbdist-body" :clip-path="`url(#mbdist-clip-${cube.id})`">
        <path :d="cube.bodyD" fill="#D9D9D9" />
        <path
          v-for="fill in cube.fills"
          :key="fill"
          :d="cube.bodyD"
          :fill="fill"
        />
      </g>
      <path class="mbdist-cap" :d="cube.capD" fill="#F2FF59" />
    </g>

    <defs>
      <pattern
        id="mbdist-p0"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img0"
          transform="matrix(0 -0.000440067 0.000849671 0 -0.739572 1.32537)"
        />
      </pattern>
      <pattern
        id="mbdist-p1"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img1"
          transform="matrix(0 0.000451568 -0.000871876 0 2.22138 -0.423638)"
        />
      </pattern>
      <pattern
        id="mbdist-p2"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img2"
          transform="matrix(0 0.000279128 -0.00043455 0 1.09142 0.0484513)"
        />
      </pattern>
      <pattern
        id="mbdist-p4"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img0"
          transform="matrix(0 -0.0006698 0.000849671 0 -0.739572 1.49523)"
        />
      </pattern>
      <pattern
        id="mbdist-p5"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img1"
          transform="matrix(0 -0.000288545 0.000366032 0 0 1.09094)"
        />
      </pattern>
      <pattern
        id="mbdist-p7"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img0"
          transform="matrix(0 -0.000910165 0.000849671 0 -0.739572 1.67295)"
        />
      </pattern>
      <pattern
        id="mbdist-p8"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          href="#mbdist-img1"
          transform="matrix(0 0.000392093 -0.000366032 0 1 -0.573803)"
        />
      </pattern>
      <image
        id="mbdist-img0"
        width="4096"
        height="2722"
        preserveAspectRatio="none"
        href="/animations/distributions/dist0.jpg"
      />
      <image
        id="mbdist-img1"
        width="4096"
        height="2732"
        preserveAspectRatio="none"
        href="/animations/distributions/dist1.jpg"
      />
      <image
        id="mbdist-img2"
        width="4096"
        height="2722"
        preserveAspectRatio="none"
        href="/animations/distributions/dist2.jpg"
      />
    </defs>
  </svg>
</template>

<!-- SVG CSS animations cannot be expressed with Tailwind utilities -->
<style scoped>
/* Echoing stroke rings: each step is 56px down at x0.90 scale, staggered so
   the visible rings always sit in the reference positions; past the bottom
   slot they keep moving and fade. */
.mbdist-echo {
  transform-box: fill-box;
  transform-origin: center;
  animation: mbdist-ring-echo 4s linear infinite;
}

.mbdist-e1 {
  animation-delay: -1.333s;
}

.mbdist-e2 {
  animation-delay: -2.667s;
}

@keyframes mbdist-ring-echo {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  33.33% {
    transform: translateY(56px) scale(0.9);
    opacity: 1;
  }
  66.66% {
    transform: translateY(112px) scale(0.81);
    opacity: 1;
  }
  100% {
    transform: translateY(168px) scale(0.729);
    opacity: 0;
  }
}

.mbdist-cube {
  transform-box: fill-box;
  transform-origin: center;
}

@media (prefers-reduced-motion: reduce) {
  .mbdist-echo {
    animation: none;
  }

  .mbdist-e1,
  .mbdist-e2 {
    display: none;
  }
}
</style>

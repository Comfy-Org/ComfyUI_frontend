<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'
import ProductHeroBadge from '../../common/ProductHeroBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="max-w-9xl relative mx-auto flex flex-col items-center overflow-hidden lg:flex-row lg:items-center lg:overflow-visible lg:pb-73"
  >
    <!-- Illustration (stacks above on mobile, left on lg) -->
    <div
      class="aspect-square w-4/5 max-w-md scale-150 self-center md:max-w-2xl lg:pointer-events-none lg:z-1 lg:-mr-12 lg:translate-x-[10%] lg:translate-y-[150px] lg:self-center xl:size-[clamp(42rem,max(50vh,40vw),44rem)] xl:min-h-[min(40vw,32rem)] xl:min-w-[min(30vw,24rem)]"
    >
      <svg
        class="block size-full overflow-visible"
        viewBox="50 50 900 900"
        fill="none"
        aria-hidden="true"
      >
        <!-- Panel 1: isometric diamond (lower-right) -->
        <rect
          x="-2.59808"
          y="3.12924e-07"
          width="510.821"
          height="510.823"
          rx="81.9867"
          transform="matrix(-0.866025 0.5 -0.866025 -0.5 924.132 890.858)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-back cloud-panel1-sm1-b"
          x="-2.59808"
          y="3.12924e-07"
          width="326.372"
          height="326.373"
          rx="52.0171"
          transform="matrix(-0.866025 0.5 -0.866025 -0.5 764.394 726.171)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-back cloud-panel1-sm2-b"
          x="-2.59808"
          y="3.12924e-07"
          width="326.372"
          height="326.373"
          rx="52.0171"
          transform="matrix(-0.866025 0.5 -0.866025 -0.5 764.394 726.171)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-front cloud-panel1-sm1-f"
          x="-2.59808"
          y="3.12924e-07"
          width="326.372"
          height="326.373"
          rx="52.0171"
          transform="matrix(-0.866025 0.5 -0.866025 -0.5 764.394 726.171)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-front cloud-panel1-sm2-f"
          x="-2.59808"
          y="3.12924e-07"
          width="326.372"
          height="326.373"
          rx="52.0171"
          transform="matrix(-0.866025 0.5 -0.866025 -0.5 764.394 726.171)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />

        <!-- Panel 2: left parallelogram (upper-left) -->
        <rect
          x="-1.29904"
          y="2.25"
          width="432.468"
          height="432.47"
          rx="48.7555"
          transform="matrix(-0.866025 0.5 0 1 387.119 24.7041)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-back cloud-panel2-sm1-b"
          x="-1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(-0.866025 0.5 0 1 435.32457 183.057)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-back cloud-panel2-sm2-b"
          x="-1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(-0.866025 0.5 0 1 435.32457 183.057)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-front cloud-panel2-sm1-f"
          x="-1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(-0.866025 0.5 0 1 435.32457 183.057)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-front cloud-panel2-sm2-f"
          x="-1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(-0.866025 0.5 0 1 435.32457 183.057)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />

        <!-- Panel 3: right parallelogram (upper-right) -->
        <rect
          x="1.29904"
          y="2.25"
          width="432.468"
          height="432.47"
          rx="48.7555"
          transform="matrix(0.866025 0.5 0 1 578.635 23.4051)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-back cloud-panel3-sm1-b"
          x="1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(0.866025 0.5 0 1 530.436 181.758)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-back cloud-panel3-sm2-b"
          x="1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(0.866025 0.5 0 1 530.436 181.758)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-front cloud-panel3-sm1-f"
          x="1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(0.866025 0.5 0 1 530.436 181.758)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />
        <rect
          class="cloud-panel-front cloud-panel3-sm2-f"
          x="1.29904"
          y="2.25"
          width="326.9"
          height="326.901"
          rx="48.7555"
          transform="matrix(0.866025 0.5 0 1 530.436 181.758)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />

        <!-- Hex block group 1 (float animation) -->
        <g>
          <!-- Yellow center (static) -->
          <path
            d="M541.711 624.12L541.724 574.634C541.726 568.056 537.111 560.058 531.417 556.77L488.58 532.038C484.973 529.956 478.487 530.052 474.881 532.136L432.031 556.89C426.335 560.181 421.716 568.181 421.714 574.76L421.701 624.246C421.7 628.41 424.86 634.074 428.467 636.156L471.304 660.888C476.998 664.176 486.232 664.173 491.929 660.883L534.778 636.128C538.392 634.041 541.71 628.293 541.711 624.12Z"
            fill="#F2FF59"
            stroke="#4D3762"
            stroke-width="3"
          />
          <!-- Top -->
          <g class="cloud-float-top">
            <path
              d="M429.565 552.893L472.414 577.647C478.111 580.938 487.344 580.94 493.039 577.653L535.876 552.921C539.482 550.838 542.642 545.173 542.641 541.009L542.628 491.523C542.626 484.944 538.007 476.944 532.311 473.653L489.461 448.899C485.855 446.815 479.37 446.72 475.763 448.803L432.926 473.535C427.232 476.822 422.617 484.82 422.619 491.399L422.632 540.885C422.633 545.058 425.951 550.805 429.565 552.893Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M608.255 518.036L565.406 493.282C559.71 489.991 550.476 489.988 544.781 493.276L501.945 518.008C498.338 520.09 495.178 525.755 495.18 529.92L495.193 579.406C495.194 585.984 499.813 593.985 505.51 597.276L548.359 622.03C551.965 624.113 558.45 624.208 562.057 622.126L604.894 597.394C610.588 594.106 615.203 586.108 615.201 579.53L615.188 530.044C615.187 525.871 611.869 520.123 608.255 518.036Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M358.991 518.037L401.84 493.282C407.536 489.992 416.77 489.989 422.465 493.277L465.301 518.009C468.908 520.091 472.068 525.756 472.067 529.921L472.053 579.407C472.052 585.985 467.433 593.986 461.736 597.277L418.887 622.031C415.281 624.114 408.796 624.209 405.189 622.127L362.352 597.395C356.658 594.107 352.043 586.109 352.045 579.531L352.058 530.045C352.059 525.872 355.377 520.124 358.991 518.037Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
          <!-- Left -->
          <g class="cloud-float-left">
            <path
              d="M397.664 624.12L397.677 574.634C397.679 568.056 393.064 560.058 387.37 556.77L344.533 532.038C340.926 529.956 334.44 530.052 330.834 532.135L287.985 556.89C282.288 560.181 277.669 568.181 277.667 574.759L277.654 624.245C277.653 628.41 280.814 634.074 284.421 636.156L327.257 660.888C332.952 664.176 342.186 664.173 347.882 660.882L390.731 636.128C394.345 634.041 397.663 628.293 397.664 624.12Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
          <!-- Yellow center (repeated for layering) -->
          <path
            d="M541.711 624.12L541.724 574.634C541.726 568.056 537.111 560.058 531.417 556.77L488.58 532.038C484.973 529.956 478.487 530.052 474.881 532.136L432.031 556.89C426.335 560.181 421.716 568.181 421.714 574.76L421.701 624.246C421.7 628.41 424.86 634.074 428.467 636.156L471.304 660.888C476.998 664.176 486.232 664.173 491.929 660.883L534.778 636.128C538.392 634.041 541.71 628.293 541.711 624.12Z"
            fill="#F2FF59"
            stroke="#4D3762"
            stroke-width="3"
          />
          <!-- Bottom -->
          <g class="cloud-float-bot">
            <path
              d="M471.137 666.027L471.15 616.541C471.152 609.962 466.537 601.964 460.842 598.677L418.006 573.945C414.399 571.863 407.913 571.959 404.307 574.042L361.457 598.797C355.761 602.087 351.142 610.088 351.14 616.666L351.127 666.152C351.126 670.317 354.286 675.98 357.893 678.063L400.73 702.795C406.424 706.082 415.658 706.08 421.354 702.789L464.204 678.035C467.817 675.947 471.136 670.2 471.137 666.027Z"
              fill="#251D2B"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M496.105 666.027L496.092 616.541C496.091 609.963 500.705 601.965 506.4 598.677L549.236 573.945C552.843 571.863 559.329 571.959 562.935 574.043L605.785 598.797C611.481 602.088 616.1 610.088 616.102 616.667L616.115 666.153C616.116 670.317 612.956 675.981 609.349 678.063L566.512 702.795C560.818 706.083 551.584 706.08 545.888 702.79L503.038 678.035C499.425 675.948 496.106 670.2 496.105 666.027Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M422.629 707.365L422.616 657.88C422.614 651.301 427.229 643.303 432.923 640.015L475.76 615.284C479.367 613.201 485.853 613.298 489.459 615.381L532.308 640.135C538.005 643.426 542.624 651.426 542.625 658.005L542.639 707.491C542.64 711.655 539.479 717.319 535.872 719.401L493.036 744.133C487.341 747.421 478.107 747.418 472.411 744.128L429.562 719.374C425.948 717.286 422.63 711.538 422.629 707.365Z"
              fill="#37303F"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
          <!-- Right -->
          <g class="cloud-float-bot">
            <path
              d="M569.578 624.119L569.565 574.633C569.563 568.055 574.178 560.057 579.873 556.769L622.709 532.037C626.316 529.955 632.802 530.051 636.408 532.134L679.258 556.889C684.954 560.18 689.573 568.18 689.575 574.758L689.588 624.244C689.589 628.409 686.429 634.073 682.822 636.155L639.985 660.887C634.291 664.175 625.057 664.172 619.36 660.881L576.511 636.127C572.898 634.04 569.579 628.292 569.578 624.119Z"
              fill="#251D2B"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
        </g>

        <!-- Diamond panel between hex groups -->
        <rect
          x="-2.59808"
          y="3.12924e-07"
          width="326.372"
          height="326.373"
          rx="52.0171"
          transform="matrix(-0.866025 0.5 -0.866025 -0.5 764.39 519.23)"
          fill="#211927"
          stroke="#4D3762"
          stroke-width="3"
        />

        <!-- Hex block group 2 (worm animation) -->
        <g>
          <!-- Yellow center (static) -->
          <path
            d="M541.703 504.44L541.716 454.955C541.718 448.376 537.103 440.378 531.409 437.09L488.572 412.359C484.965 410.276 478.479 410.373 474.873 412.456L432.024 437.21C426.327 440.501 421.708 448.501 421.707 455.08L421.693 504.566C421.692 508.731 424.853 514.394 428.46 516.477L471.296 541.208C476.991 544.496 486.225 544.493 491.921 541.203L534.77 516.449C538.384 514.361 541.702 508.613 541.703 504.44Z"
            fill="#F2FF59"
            stroke="#4D3762"
            stroke-width="3"
          />
          <!-- Top (worm) -->
          <g class="cloud-worm-top">
            <path
              d="M429.553 433.214L472.403 457.968C478.099 461.259 487.333 461.261 493.027 457.973L535.864 433.242C539.471 431.159 542.63 425.494 542.629 421.329L542.616 371.843C542.614 365.265 537.995 357.264 532.299 353.974L489.449 329.219C485.843 327.136 479.358 327.041 475.751 329.124L432.915 353.855C427.22 357.143 422.605 365.141 422.607 371.72L422.62 421.205C422.621 425.378 425.94 431.126 429.553 433.214Z"
              fill="#251D2B"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M608.248 398.356L565.398 373.602C559.702 370.311 550.468 370.308 544.774 373.596L501.937 398.328C498.33 400.41 495.171 406.075 495.172 410.24L495.185 459.726C495.187 466.305 499.806 474.305 505.502 477.596L548.351 502.35C551.958 504.433 558.443 504.528 562.049 502.446L604.886 477.714C610.581 474.426 615.195 466.428 615.194 459.85L615.181 410.364C615.18 406.191 611.861 400.443 608.248 398.356Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M358.979 398.357L401.828 373.602C407.525 370.312 416.759 370.309 422.453 373.597L465.29 398.329C468.896 400.411 472.056 406.076 472.055 410.241L472.042 459.727C472.04 466.305 467.421 474.306 461.725 477.597L418.875 502.351C415.269 504.434 408.784 504.529 405.177 502.447L362.341 477.715C356.646 474.427 352.031 466.429 352.033 459.851L352.046 410.365C352.047 406.192 355.365 400.444 358.979 398.357Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
          <!-- Left (worm) -->
          <g class="cloud-worm-left">
            <path
              d="M397.656 504.44L397.669 454.954C397.671 448.376 393.056 440.378 387.362 437.09L344.525 412.358C340.918 410.276 334.433 410.372 330.826 412.455L287.977 437.21C282.281 440.5 277.661 448.501 277.66 455.079L277.647 504.565C277.645 508.73 280.806 514.394 284.413 516.476L327.249 541.208C332.944 544.495 342.178 544.493 347.874 541.202L390.723 516.448C394.337 514.361 397.655 508.613 397.656 504.44Z"
              fill="#251D2B"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
          <!-- Yellow center (repeated for layering) -->
          <path
            d="M541.703 504.44L541.716 454.955C541.718 448.376 537.103 440.378 531.409 437.09L488.572 412.359C484.965 410.276 478.479 410.373 474.873 412.456L432.024 437.21C426.327 440.501 421.708 448.501 421.707 455.08L421.693 504.566C421.692 508.731 424.853 514.394 428.46 516.477L471.296 541.208C476.991 544.496 486.225 544.493 491.921 541.203L534.77 516.449C538.384 514.361 541.702 508.613 541.703 504.44Z"
            fill="#F2FF59"
            stroke="#4D3762"
            stroke-width="3"
          />
          <!-- Bottom (worm) -->
          <g class="cloud-worm-bot">
            <path
              d="M471.125 546.35L471.138 496.864C471.14 490.285 466.525 482.287 460.831 479L417.994 454.268C414.387 452.186 407.901 452.282 404.295 454.365L361.445 479.12C355.749 482.41 351.13 490.411 351.128 496.989L351.115 546.475C351.114 550.64 354.275 556.303 357.881 558.386L400.718 583.118C406.413 586.405 415.647 586.403 421.343 583.112L464.192 558.358C467.806 556.27 471.124 550.523 471.125 546.35Z"
              fill="#37303F"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M496.094 546.35L496.081 496.864C496.079 490.286 500.694 482.288 506.388 479L549.225 454.268C552.832 452.186 559.317 452.282 562.924 454.366L605.773 479.12C611.469 482.411 616.089 490.411 616.09 496.99L616.103 546.476C616.104 550.64 612.944 556.304 609.337 558.386L566.501 583.118C560.806 586.406 551.572 586.403 545.876 583.113L503.027 558.358C499.413 556.271 496.095 550.523 496.094 546.35Z"
              fill="#211927"
              stroke="#4D3762"
              stroke-width="3"
            />
            <path
              d="M422.617 587.688L422.604 538.202C422.602 531.624 427.217 523.626 432.912 520.338L475.748 495.606C479.355 493.524 485.841 493.62 489.447 495.704L532.297 520.458C537.993 523.749 542.612 531.749 542.614 538.328L542.627 587.813C542.628 591.978 539.468 597.642 535.861 599.724L493.024 624.456C487.33 627.744 478.096 627.741 472.399 624.45L429.55 599.696C425.937 597.609 422.618 591.861 422.617 587.688Z"
              fill="#251D2B"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
          <!-- Right (worm) -->
          <g class="cloud-worm-right">
            <path
              d="M569.57 504.439L569.557 454.953C569.555 448.375 574.17 440.377 579.865 437.089L622.701 412.357C626.308 410.275 632.794 410.371 636.4 412.455L679.25 437.209C684.946 440.5 689.565 448.5 689.567 455.079L689.58 504.564C689.581 508.729 686.421 514.393 682.814 516.475L639.977 541.207C634.283 544.495 625.049 544.492 619.353 541.201L576.503 516.447C572.89 514.36 569.571 508.612 569.57 504.439Z"
              fill="#37303F"
              stroke="#4D3762"
              stroke-width="3"
            />
          </g>
        </g>
      </svg>
    </div>

    <!-- Text -->
    <div
      class="relative z-10 mt-17 w-full px-4 pb-16 lg:mt-0 lg:min-w-160 lg:flex-1 lg:translate-x-[10%] lg:px-20 lg:py-24"
    >
      <ProductHeroBadge text="CLOUD" />

      <h1
        class="text-primary-comfy-canvas mt-8 text-4xl/tight font-light whitespace-pre-line md:text-5xl/tight lg:max-w-2xl lg:text-6xl/tight"
      >
        {{ t('cloud.hero.heading', locale) }}
      </h1>

      <p
        class="text-primary-comfy-canvas mt-8 max-w-md text-sm lg:mt-10 lg:text-base"
      >
        {{ t('cloud.hero.subtitle', locale) }}
      </p>

      <div class="mt-10">
        <BrandButton
          :href="externalLinks.cloud"
          :label="t('cloud.hero.cta', locale)"
          size="lg"
          class-name="text-center lg:min-w-60"
        />
      </div>
    </div>
  </section>
</template>

<!-- SVG CSS animations cannot be expressed with Tailwind utilities -->
<style scoped>
@keyframes cloudMorphPanel1 {
  0% {
    width: 326.372px;
    height: 326.373px;
    rx: 52.0171px;
    transform: matrix(-0.866, 0.5, -0.866, -0.5, 764.394, 726.171);
  }
  100% {
    width: 510.821px;
    height: 510.823px;
    rx: 81.9867px;
    transform: matrix(-0.866, 0.5, -0.866, -0.5, 924.132, 890.858);
  }
}

@keyframes cloudMorphPanel2 {
  0% {
    width: 326.9px;
    height: 326.901px;
    transform: matrix(-0.866, 0.5, 0, 1, 435.3246, 183.057);
  }
  100% {
    width: 432.468px;
    height: 432.47px;
    transform: matrix(-0.866, 0.5, 0, 1, 387.119, 24.7041);
  }
}

@keyframes cloudMorphPanel3 {
  0% {
    width: 326.9px;
    height: 326.901px;
    transform: matrix(0.866, 0.5, 0, 1, 530.436, 181.758);
  }
  100% {
    width: 432.468px;
    height: 432.47px;
    transform: matrix(0.866, 0.5, 0, 1, 578.635, 23.4051);
  }
}

@keyframes cloudFrontOp {
  0%,
  49.999% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@keyframes cloudBackOp {
  0%,
  49.999% {
    opacity: 0;
  }
  50%,
  95% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes cloudFloatTop {
  0%,
  100% {
    transform: translateY(0);
  }
  33% {
    transform: translateY(-30px);
  }
  66% {
    transform: translateY(15px);
  }
}

@keyframes cloudFloatLeft {
  0%,
  100% {
    transform: translateY(0);
  }
  33% {
    transform: translateY(-30px);
  }
  66% {
    transform: translateY(15px);
  }
}

@keyframes cloudFloatBot {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-40px);
  }
}

@keyframes cloudFloatWorm {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-40px);
  }
}

.cloud-panel-back,
.cloud-panel-front {
  animation-duration: 2s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  animation-iteration-count: infinite;
}

.cloud-panel1-sm1-b {
  animation-name: cloudMorphPanel1, cloudBackOp;
}
.cloud-panel1-sm2-b {
  animation-name: cloudMorphPanel1, cloudBackOp;
  animation-delay: 1s, 1s;
}
.cloud-panel1-sm1-f {
  animation-name: cloudMorphPanel1, cloudFrontOp;
}
.cloud-panel1-sm2-f {
  animation-name: cloudMorphPanel1, cloudFrontOp;
  animation-delay: 1s, 1s;
}

.cloud-panel2-sm1-b {
  animation-name: cloudMorphPanel2, cloudBackOp;
}
.cloud-panel2-sm2-b {
  animation-name: cloudMorphPanel2, cloudBackOp;
  animation-delay: 1s, 1s;
}
.cloud-panel2-sm1-f {
  animation-name: cloudMorphPanel2, cloudFrontOp;
}
.cloud-panel2-sm2-f {
  animation-name: cloudMorphPanel2, cloudFrontOp;
  animation-delay: 1s, 1s;
}

.cloud-panel3-sm1-b {
  animation-name: cloudMorphPanel3, cloudBackOp;
}
.cloud-panel3-sm2-b {
  animation-name: cloudMorphPanel3, cloudBackOp;
  animation-delay: 1s, 1s;
}
.cloud-panel3-sm1-f {
  animation-name: cloudMorphPanel3, cloudFrontOp;
}
.cloud-panel3-sm2-f {
  animation-name: cloudMorphPanel3, cloudFrontOp;
  animation-delay: 1s, 1s;
}

.cloud-float-top {
  animation: cloudFloatTop 4.2s ease-in-out infinite;
}

.cloud-float-left {
  animation: cloudFloatLeft 4.5s ease-in-out infinite;
}

.cloud-float-bot {
  animation: cloudFloatBot 5.1s ease-in-out infinite;
}

.cloud-worm-left {
  animation: cloudFloatWorm 3s ease-in-out infinite 0s;
}
.cloud-worm-bot {
  animation: cloudFloatWorm 3s ease-in-out infinite 0.4s;
}
.cloud-worm-right {
  animation: cloudFloatWorm 3s ease-in-out infinite 0.8s;
}
.cloud-worm-top {
  animation: cloudFloatWorm 3s ease-in-out infinite 1.2s;
}

@media (prefers-reduced-motion: reduce) {
  [class*='cloud-panel'],
  [class*='cloud-float'],
  [class*='cloud-worm'] {
    animation: none;
  }
}
</style>

<script setup lang="ts">
// Pre-execution placeholder. Cycles through a small palette of
// "Nihon no iro" inspired gradients so a fresh tile reads as
// intentional rather than empty. Mid-value lightness keeps the
// jump small when the latent / final image arrives.
//
// These gradients are deliberately fixed visual identity, not theme
// tokens. They are placeholder art, not chrome — like a brand mark
// or a logo gradient, they should look the same regardless of the
// active palette. The mid-value lightness (~40-45%) is chosen so an
// incoming preview image doesn't pop against a too-dark or too-light
// field, which would be undermined by theme-driven recoloring. If
// future product feedback says these should follow the active theme,
// the right move is a separate set of design-system tokens
// (--latent-preview-gradient-{0,1,2,3}) with explicit light and
// dark variants — not computing from palette tokens.
const { variant = 0 } = defineProps<{ variant?: number }>()
</script>

<template>
  <div class="size-full" :class="`latent-bg-${((variant % 4) + 4) % 4}`" />
</template>

<style scoped>
/* Vertical 3-stop gradients — dark crown, mid-value belly, warm
   foot. Average lightness ~40-45% so an incoming preview image
   doesn't pop against a too-dark or too-light field.
   Hex values are deliberate; see the script-block comment. */
.latent-bg-0 {
  background: linear-gradient(180deg, #1d2a44 0%, #3e5876 50%, #c5a07b 100%);
}
.latent-bg-1 {
  background: linear-gradient(180deg, #2e1a2c 0%, #6e3742 50%, #d4845c 100%);
}
.latent-bg-2 {
  background: linear-gradient(180deg, #1f1c3a 0%, #463e6a 50%, #8f7b9c 100%);
}
.latent-bg-3 {
  background: linear-gradient(180deg, #1a2620 0%, #3d5a48 50%, #a89c74 100%);
}
</style>

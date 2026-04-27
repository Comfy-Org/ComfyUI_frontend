<script setup lang="ts">
// Pre-execution placeholder — Run clicked, model still loading, no
// latent yet. Solid dark fill (the same `--color-layout-canvas` token
// the input widgets recess into) reads as a neutral container that's
// clearly waiting on content, without the looping shimmer animation
// implying false progress. The run-status overlay (progress bar +
// step counter + Stop) handles the actual "is something happening"
// signal.
</script>
<template>
  <!-- Fills its container so the loading state lines up pixel-for-
       pixel with the eventual finalized image — same margins, same
       outer bounds. Border matches the chrome-family hairline (rgb
       255/255/255/0.08); fill matches the input-widget background
       so the empty state visually pairs with other recessed surfaces. -->
  <div
    class="size-full rounded-lg border border-white/8 bg-layout-canvas"
  />
</template>

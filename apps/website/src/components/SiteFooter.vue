<script setup lang="ts">
const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Comfy Desktop', href: '/download' },
      { label: 'Comfy Cloud', href: 'https://app.comfy.org' },
      { label: 'ComfyHub', href: 'https://hub.comfy.org' },
      { label: 'Pricing', href: '/pricing' }
    ]
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: 'https://docs.comfy.org' },
      { label: 'Blog', href: 'https://blog.comfy.org' },
      { label: 'Gallery', href: '/gallery' },
      { label: 'GitHub', href: 'https://github.com/comfyanonymous/ComfyUI' }
    ]
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Enterprise', href: '/enterprise' }
    ]
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms-of-service' },
      { label: 'Privacy Policy', href: '/privacy-policy' }
    ]
  }
]

const socials = [
  { label: 'GitHub', href: 'https://github.com/comfyanonymous/ComfyUI', icon: '/icons/social/github.svg' },
  { label: 'Discord', href: 'https://discord.gg/comfyorg', icon: '/icons/social/discord.svg' },
  { label: 'X', href: 'https://x.com/comaboratory', icon: '/icons/social/x.svg' },
  { label: 'Reddit', href: 'https://reddit.com/r/comfyui', icon: '/icons/social/reddit.svg' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/comfyorg', icon: '/icons/social/linkedin.svg' },
  { label: 'Instagram', href: 'https://instagram.com/comfyorg', icon: '/icons/social/instagram.svg' }
]
</script>

<template>
  <footer class="border-t border-white/10 bg-black">
    <div
      class="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-5"
    >
      <!-- Brand -->
      <div class="lg:col-span-1">
        <a href="/" class="text-2xl font-bold italic text-brand-yellow">
          Comfy
        </a>
        <p class="mt-4 text-sm text-smoke-700">
          Professional control of visual AI.
        </p>
      </div>

      <!-- Link columns -->
      <nav
        v-for="column in columns"
        :key="column.title"
        :aria-label="column.title"
        class="flex flex-col gap-3"
      >
        <h3 class="text-sm font-semibold text-white">{{ column.title }}</h3>
        <a
          v-for="link in column.links"
          :key="link.href"
          :href="link.href"
          class="text-sm text-smoke-700 transition-colors hover:text-white"
        >
          {{ link.label }}
        </a>
      </nav>
    </div>

    <!-- Bottom bar -->
    <div class="border-t border-white/10">
      <div
        class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row"
      >
        <p class="text-sm text-smoke-700">
          &copy; {{ new Date().getFullYear() }} Comfy Org. All rights reserved.
        </p>

        <!-- Social icons -->
        <div class="flex items-center gap-4">
          <a
            v-for="social in socials"
            :key="social.label"
            :href="social.href"
            :aria-label="social.label"
            target="_blank"
            rel="noopener noreferrer"
            class="text-smoke-700 transition-colors hover:text-white"
          >
            <span
              class="inline-block h-5 w-5 bg-current"
              :style="{
                maskImage: `url(${social.icon})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskImage: `url(${social.icon})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat'
              }"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

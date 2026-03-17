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
  {
    label: 'GitHub',
    href: 'https://github.com/comfyanonymous/ComfyUI',
    icon: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z'
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/comfyorg',
    icon: 'M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38Zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38Z'
  },
  {
    label: 'X',
    href: 'https://x.com/comaboratory',
    icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
  },
  {
    label: 'Reddit',
    href: 'https://reddit.com/r/comfyui',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm5.8 11.33c.02.16.03.33.03.5 0 2.55-2.97 4.63-6.63 4.63-3.65 0-6.62-2.07-6.62-4.63 0-.17.01-.34.03-.5a1.58 1.58 0 0 1-.63-1.27c0-.88.72-1.59 1.6-1.59.44 0 .83.18 1.12.46 1.1-.79 2.62-1.3 4.31-1.37l.73-3.44a.32.32 0 0 1 .39-.24l2.43.52a1.13 1.13 0 0 1 2.15.36 1.13 1.13 0 0 1-1.13 1.12 1.13 1.13 0 0 1-1.08-.82l-2.16-.46-.65 3.07c1.65.09 3.14.59 4.22 1.36.29-.28.69-.46 1.13-.46.88 0 1.6.71 1.6 1.59 0 .52-.25.97-.63 1.27ZM9.5 13.5c0 .63.51 1.13 1.13 1.13s1.12-.5 1.12-1.13-.5-1.12-1.12-1.12-1.13.5-1.13 1.12Zm5.75 2.55c-.69.69-2 .73-3.25.73s-2.56-.04-3.25-.73a.32.32 0 1 1 .45-.45c.44.44 1.37.6 2.8.6 1.43 0 2.37-.16 2.8-.6a.32.32 0 1 1 .45.45Zm-.37-1.42c.62 0 1.13-.5 1.13-1.13 0-.62-.51-1.12-1.13-1.12-.63 0-1.13.5-1.13 1.12 0 .63.5 1.13 1.13 1.13Z'
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/comfyorg',
    icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z'
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/comfyorg',
    icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z'
  }
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
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path :d="social.icon" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

import { cva } from 'class-variance-authority'

export { default as NavigationMenu } from './NavigationMenu.vue'
export { default as NavigationMenuContent } from './NavigationMenuContent.vue'
export { default as NavigationMenuItem } from './NavigationMenuItem.vue'
export { default as NavigationMenuLink } from './NavigationMenuLink.vue'
export { default as NavigationMenuList } from './NavigationMenuList.vue'
export { default as NavigationMenuTrigger } from './NavigationMenuTrigger.vue'

export const navigationMenuTriggerStyle = cva([
  'group font-formula item-center inline-flex cursor-pointer justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-extrabold tracking-wider text-primary-comfy-canvas uppercase transition-[color,box-shadow] outline-none',
  'hover:text-primary-warm-gray',
  'data-[state=open]:hover:text-primary-comfy-yellow data-[state=open]:text-primary-comfy-yellow data-[state=open]:focus:text-primary-comfy-yellow',
  'focus:bg-accent focus-visible:ring-primary-comfy-yellow focus:text-accent-foreground focus-visible:ring-3 focus-visible:outline-1',
  'disabled:pointer-events-none disabled:opacity-50'
])

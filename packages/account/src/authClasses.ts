/**
 * The onboarding pages' shared treatments, so both hosts style the same
 * controls the same way. Each host adds what its own component library
 * supplies implicitly.
 */

/** Fill matches the social buttons; inputs need it set explicitly. */
export const AUTH_FIELD_CLASS =
  'h-11 rounded-2xl bg-transparency-white-t8 px-4 text-primary-warm-white placeholder:text-transparency-white-t40 xl:h-12'

/** Buttons styled as links: they toggle form mode, they do not navigate. */
export const AUTH_LINK_BUTTON_CLASS =
  'mt-2 cursor-pointer self-center border-none bg-transparent p-0 font-[inherit] text-base text-primary-comfy-canvas underline transition-all duration-300 hover:text-white sm:text-lg'

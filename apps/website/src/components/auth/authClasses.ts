/**
 * The cloud onboarding pages' shared treatments (constants/authClasses.ts and
 * the brand Button variants in the app), plus the PrimeVue Aura dark rules
 * their components inherit there and have to be spelled out here.
 */

/** Button base + size `brand` from the app's button.variants.ts. */
const BRAND_BUTTON_BASE =
  'relative inline-flex h-12 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-2xl border-none px-5 font-formula text-sm font-semibold tracking-[0.7px] whitespace-nowrap uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 lg:h-13 xl:h-14 2xl:h-16 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([width]):not([height])]:size-4'

export const AUTH_BRAND_GHOST_BUTTON_CLASS = `${BRAND_BUTTON_BASE} bg-transparency-white-t8 text-primary-warm-white hover:bg-transparency-white-t20 focus-visible:ring-brand-yellow`

export const AUTH_BRAND_SOLID_BUTTON_CLASS = `${BRAND_BUTTON_BASE} bg-brand-yellow text-primary-comfy-ink hover:bg-brand-yellow/90 focus-visible:ring-primary-warm-white`

/** Buttons styled as links: they toggle or retry, they do not navigate. */
export const AUTH_LINK_BUTTON_CLASS =
  'mt-2 cursor-pointer self-center border-none bg-transparent p-0 font-[inherit] text-base text-primary-comfy-canvas underline transition-all duration-300 hover:text-white sm:text-lg'

/**
 * CLOUD_AUTH_FIELD_CLASS on top of PrimeVue's InputText base and Aura's dark
 * form-field tokens (zinc borders, blue-400 focus, red-300 invalid).
 */
export const AUTH_FIELD_CLASS =
  'h-11 w-full appearance-none rounded-2xl border border-[#52525b] bg-transparency-white-t8 px-4 text-base text-primary-warm-white shadow-[0_0_#0000,0_0_#0000,0_1px_2px_0_rgba(18,18,23,0.05)] transition-[background,color,border-color,outline-color,box-shadow] duration-200 outline-none placeholder:text-transparency-white-t40 hover:border-[#71717a] focus:border-[#60a5fa] aria-invalid:border-[#fca5a5] aria-invalid:placeholder:text-[#f87171] xl:h-12'

/** PrimeVue Message, severity error, Aura dark. */
export const AUTH_MESSAGE_ERROR_CLASS =
  'flex items-center gap-2 rounded-[6px] bg-[color-mix(in_srgb,#ef4444,transparent_84%)] px-3 py-2 text-base font-medium text-[#ef4444] shadow-[0px_4px_8px_0px_color-mix(in_srgb,#ef4444,transparent_96%)] outline outline-1 outline-[color-mix(in_srgb,#b91c1c,transparent_64%)]'

/** PrimeVue Message, severity warn, Aura dark. */
export const AUTH_MESSAGE_WARN_CLASS =
  'flex items-center gap-2 rounded-[6px] bg-[color-mix(in_srgb,#eab308,transparent_84%)] px-3 py-2 text-base font-medium text-[#eab308] shadow-[0px_4px_8px_0px_color-mix(in_srgb,#eab308,transparent_96%)] outline outline-1 outline-[color-mix(in_srgb,#a16207,transparent_64%)]'

/** PrimeVue Message, severity success, Aura dark. */
export const AUTH_MESSAGE_SUCCESS_CLASS =
  'flex items-center gap-2 rounded-[6px] bg-[color-mix(in_srgb,#22c55e,transparent_84%)] px-3 py-2 text-base font-medium text-[#22c55e] shadow-[0px_4px_8px_0px_color-mix(in_srgb,#22c55e,transparent_96%)] outline outline-1 outline-[color-mix(in_srgb,#15803d,transparent_64%)]'

/**
 * The cloud onboarding pages' shared treatments (constants/authClasses.ts in
 * the app), plus the PrimeVue Aura dark rules their components inherit there
 * and have to be spelled out here.
 */

/** Buttons styled as links: they toggle or retry, they do not navigate. */
export const AUTH_LINK_BUTTON_CLASS =
  'mt-2 cursor-pointer self-center border-none bg-transparent p-0 font-[inherit] text-base text-primary-comfy-canvas underline transition-all duration-300 hover:text-white sm:text-lg'

/** PrimeVue Message, severity error, Aura dark. */
export const AUTH_MESSAGE_ERROR_CLASS =
  'flex items-center gap-2 rounded-[6px] bg-[color-mix(in_srgb,#ef4444,transparent_84%)] px-3 py-2 text-base font-medium text-[#ef4444] shadow-[0px_4px_8px_0px_color-mix(in_srgb,#ef4444,transparent_96%)] outline outline-1 outline-[color-mix(in_srgb,#b91c1c,transparent_64%)]'

/** PrimeVue Message, severity warn, Aura dark. */
export const AUTH_MESSAGE_WARN_CLASS =
  'flex items-center gap-2 rounded-[6px] bg-[color-mix(in_srgb,#eab308,transparent_84%)] px-3 py-2 text-base font-medium text-[#eab308] shadow-[0px_4px_8px_0px_color-mix(in_srgb,#eab308,transparent_96%)] outline outline-1 outline-[color-mix(in_srgb,#a16207,transparent_64%)]'

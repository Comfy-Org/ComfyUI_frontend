/**
 * Fill matches the social buttons; inputs need it set explicitly.
 * Also applied to `PasswordInput`, whose root is an `InputGroup`: the shell
 * classes land on the group and the `**:` variants reach its control and
 * toggle.
 */
export const CLOUD_AUTH_FIELD_CLASS =
  'h-11 rounded-2xl bg-transparency-white-t8 text-primary-warm-white placeholder:text-transparency-white-t40 xl:h-12 **:data-[slot=input-group-control]:placeholder:text-transparency-white-t40 **:data-[slot=input-group-button]:text-primary-comfy-canvas/70'

export const CLOUD_AUTH_LABEL_CLASS =
  'text-base font-normal text-primary-comfy-canvas/70'

/** Buttons styled as links: they toggle form mode, they do not navigate. */
export const CLOUD_AUTH_LINK_BUTTON_CLASS =
  'mt-2 cursor-pointer self-center border-none bg-transparent p-0 font-[inherit] text-base text-primary-comfy-canvas underline transition-all duration-300 hover:text-white sm:text-lg'

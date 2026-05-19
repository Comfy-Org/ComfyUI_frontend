/**
 * Normalize a custom-node pack identifier into a URL-safe slug.
 *
 * Pack ids originate from Python module names exposed by ComfyUI and the
 * Comfy custom-node registry. The upstream names mix three conventions
 * freely: kebab-case (`comfyui-impact-pack`), snake_case
 * (`comfyui_impact_pack`), and PascalCase (`ComfyUI-Crystools`). Using
 * those raw strings as URL segments produces routes that are inconsistent
 * across packs and fail the website's `[a-z0-9-]+` slug contract.
 *
 * `slugifyPackId` produces a deterministic, lowercase, hyphen-only slug
 * suitable for use as a URL segment and as an `Astro.params` value. It
 * does NOT replace the raw id used for registry lookups; callers that
 * need to query the registry API must keep the raw `node_id` separately.
 *
 * The transformation is intentionally narrow:
 *   - lowercase
 *   - replace `_` with `-`
 *   - collapse runs of `-` to a single `-`
 *   - strip leading / trailing `-`
 *
 * Any other character (digits, letters, `-`) is preserved verbatim so
 * legitimate registry ids like `comfyui-flashvsr-ultra-fast` survive
 * untouched. The output is guaranteed to match `/^[a-z0-9-]+$/` as long
 * as the input only contains ASCII letters, digits, `_`, and `-` — which
 * is the case for every pack id observed in the registry today.
 */
export function slugifyPackId(rawId: string): string {
  return rawId
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

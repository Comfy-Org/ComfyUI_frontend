/**
 * Serialize an object to a JSON string safe to embed inside an inline
 * `<script type="application/ld+json">` tag.
 *
 * Pack metadata flows in from the public ComfyUI registry, where any user
 * can publish a pack with a `displayName`, `description`, or
 * `publisher.name` that contains `</script>` or `<!--`. Without escaping,
 * those sequences would close the surrounding `<script>` tag and allow
 * stored XSS.
 *
 * Escapes:
 * - Every `<` (covers `</script>`, `<script`, `<!--`)
 * - U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR (which are
 *   line terminators in HTML script context but valid characters
 *   elsewhere in JSON, so `JSON.stringify` does not escape them)
 *
 * Reference: https://v8.dev/features/subsume-json
 */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

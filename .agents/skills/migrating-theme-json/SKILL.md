---
name: migrating-theme-json
description: Migrates legacy ComfyUI palette JSON to colors.theme. Use when converting an old palette export or updating a custom theme.
---

# Migrating theme JSON

Produce a usable theme, not an exact reproduction of legacy colors.

1. Keep the original JSON. Write the migrated palette to a separate file with
   a custom ID distinct from the built-in palettes.
2. Read `paletteSchema`, `themeSchema`, and `resolvePaletteTheme`. Use the
   current built-in Light or Dark palette matching `light_theme` and its
   resolved defaults as the baseline.
3. Preserve metadata and the legacy color sections used by the canvas and
   extensions. Populate every supported `colors.theme` key explicitly so
   legacy derivation cannot supply unresolved values for omitted keys.
4. Transfer the old palette's surface, text, border, and node colors by role.
   Preserve existing explicit theme choices. Resolve legacy `var()` expressions
   to concrete CSS colors; use the baseline when a value cannot be resolved.
   Explicit `colors.theme` values take precedence over legacy fields.
5. Validate the result against `paletteSchema`. Import it into ComfyUI and
   check panels, inputs, node labels, focus, hover, and selected states.
   Verify readable text and distinct interaction states; replace unusable
   colors with the baseline. Switch to another palette and back.
6. Return the migrated JSON with any fallback substitutions listed. Tell the
   user to import it through the palette controls and make future theme edits
   in `colors.theme`. Keep compatibility changes out of application code.

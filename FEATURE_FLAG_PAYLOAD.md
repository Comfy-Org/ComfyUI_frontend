# Feature Flag Payload Shape

## Feature Flag Key
`demo-run-button-experiment`

## Expected Structure

The feature flag value should be either:

### Control (Original Button)
- `false`
- `null`
- `undefined`
- Not set

When any of these values are present, the original SplitButton will be displayed.

### Experiment (Experimental Button)
An object with the following structure:

```typescript
{
  variant: string,           // Required: variant name (e.g., "bold-gradient", "animated", "playful", "minimal")
  payload?: {                // Optional: styling and content overrides
    label?: string,          // Button text (default: "Run")
    icon?: string,           // Icon class (default: variant-specific)
    backgroundColor?: string, // Background color/class (default: variant-specific)
    textColor?: string,      // Text color/class (default: variant-specific)
    borderRadius?: string,   // Border radius class (default: variant-specific)
    padding?: string         // Padding class (default: "px-4 py-2")
  }
}
```

## Example Payloads

### Bold Gradient Variant
```json
{
  "variant": "bold-gradient",
  "payload": {
    "label": "Run",
    "icon": "icon-[lucide--zap]",
    "backgroundColor": "transparent",
    "textColor": "white",
    "borderRadius": "rounded-xl"
  }
}
```

### Animated Variant
```json
{
  "variant": "animated",
  "payload": {
    "label": "Launch",
    "icon": "icon-[lucide--rocket]",
    "backgroundColor": "bg-primary-background",
    "textColor": "white",
    "borderRadius": "rounded-full"
  }
}
```

### Playful Variant
```json
{
  "variant": "playful",
  "payload": {
    "label": "Go!",
    "icon": "icon-[lucide--sparkles]",
    "backgroundColor": "bg-gradient-to-br from-yellow-400 to-orange-500",
    "textColor": "white",
    "borderRadius": "rounded-2xl"
  }
}
```

### Minimal Variant
```json
{
  "variant": "minimal",
  "payload": {
    "label": "Run",
    "icon": "icon-[lucide--play]",
    "backgroundColor": "bg-white",
    "textColor": "text-gray-800",
    "borderRadius": "rounded-md"
  }
}
```

## Payload Properties

### `variant` (required)
- Type: `string`
- Description: The variant name that determines the base styling and behavior
- Supported values:
  - `"bold-gradient"` - Gradient background with animated effect
  - `"animated"` - Pulsing animation effect
  - `"playful"` - Sparkle effects with playful styling
  - `"minimal"` - Clean, minimal design
  - Any custom variant name (will use default styling)

### `payload.label` (optional)
- Type: `string`
- Default: `"Run"` (or variant-specific default)
- Description: The text displayed on the button

### `payload.icon` (optional)
- Type: `string`
- Default: Variant-specific icon
- Description: Icon class name (e.g., `"icon-[lucide--play]"`)
- Examples:
  - `"icon-[lucide--play]"` - Play icon
  - `"icon-[lucide--zap]"` - Lightning bolt
  - `"icon-[lucide--rocket]"` - Rocket
  - `"icon-[lucide--sparkles]"` - Sparkles

### `payload.backgroundColor` (optional)
- Type: `string`
- Default: Variant-specific background
- Description: Tailwind CSS class or CSS color value for background
- Examples:
  - `"bg-primary-background"` - Primary background color
  - `"bg-white"` - White background
  - `"transparent"` - Transparent (for gradient overlays)
  - `"bg-gradient-to-br from-yellow-400 to-orange-500"` - Gradient

### `payload.textColor` (optional)
- Type: `string`
- Default: Variant-specific text color
- Description: Tailwind CSS class or CSS color value for text
- Examples:
  - `"white"` - White text (CSS color)
  - `"text-white"` - White text (Tailwind class)
  - `"text-gray-800"` - Dark gray text

### `payload.borderRadius` (optional)
- Type: `string`
- Default: Variant-specific border radius
- Description: Tailwind CSS border radius class
- Examples:
  - `"rounded-md"` - Medium border radius
  - `"rounded-xl"` - Extra large border radius
  - `"rounded-full"` - Fully rounded (pill shape)
  - `"rounded-2xl"` - 2x extra large border radius

### `payload.padding` (optional)
- Type: `string`
- Default: `"px-4 py-2"`
- Description: Tailwind CSS padding classes
- Examples:
  - `"px-4 py-2"` - Standard padding
  - `"px-6 py-3"` - Larger padding
  - `"px-2 py-1"` - Smaller padding

## Backend Integration

The backend should send this feature flag via WebSocket in the `feature_flags` message:

```json
{
  "type": "feature_flags",
  "data": {
    "demo-run-button-experiment": {
      "variant": "bold-gradient",
      "payload": {
        "label": "Run",
        "icon": "icon-[lucide--zap]",
        "textColor": "white",
        "borderRadius": "rounded-xl"
      }
    }
  }
}
```

Or to show the control (original button):

```json
{
  "type": "feature_flags",
  "data": {
    "demo-run-button-experiment": false
  }
}
```

## Notes

- All `payload` properties are optional - if omitted, variant-specific defaults will be used
- The `variant` property is required when the flag is truthy
- Color values can be either Tailwind classes (e.g., `"text-white"`) or CSS color values (e.g., `"white"`)
- The component will automatically handle both formats


# Settings System

## Overview

ComfyUI frontend uses a comprehensive settings system for user preferences with support for dynamic defaults, version-based rollouts, and environment-aware configuration.

### Settings Architecture

- Settings are defined as `SettingParams` in `src/platform/settings/constants/coreSettings.ts`
- Registered at app startup, loaded/saved via `useSettingStore` (Pinia)
- Persisted per user via backend `/settings` endpoint
- If a value hasn't been set by the user, the store returns the computed default

```typescript
// From src/platform/settings/settingStore.ts
function getDefaultValue<K extends keyof Settings>(
  key: K
): Settings[K] | undefined {
  const param = getSettingById(key)

  if (param === undefined) return

  const versionedDefault = getVersionedDefaultValue(key, param)

  if (versionedDefault) {
    return versionedDefault
  }

  const defaultValue = param.defaultValue
  return resolveDefaultValue(defaultValue)
}
```

### Settings Registration Process

Settings are registered after server values are loaded:

```typescript
// From src/components/graph/GraphCanvas.vue
// Register core settings immediately after settings are ready
CORE_SETTINGS.forEach(settingStore.addSetting)

await Promise.all([
  until(() => isI18nReady.value || !!i18nError.value).toBe(true),
  useNewUserService().initializeIfNewUser()
])
```

## Dynamic and Environment-Based Defaults

### Computed Defaults

You can compute defaults dynamically using function defaults that access runtime context:

```typescript
// From src/platform/settings/constants/coreSettings.ts
{
  id: 'Comfy.Sidebar.Size',
  // Default to small if the window is less than 1536px(2xl) wide
  defaultValue: () => (window.innerWidth < 1536 ? 'small' : 'normal')
}
```

A function default can also be a named import rather than an inline arrow:

```typescript
// From src/platform/settings/constants/coreSettings.ts
// getDefaultLocale() is defined in src/locales/localeConfig.ts
{
  id: 'Comfy.Locale',
  defaultValue: getDefaultLocale
}
```

### Version-Based Defaults

You can vary defaults by installed frontend version using `defaultsByInstallVersion`:

```typescript
// From src/platform/settings/settingStore.ts
// `compare` and `valid` come from semver
function getVersionedDefaultValue<
  K extends keyof Settings,
  TValue = Settings[K]
>(key: K, param: SettingParams<TValue> | undefined): TValue | null {
  // skip 'Comfy.InstalledVersion' to prevent an infinite loop
  const defaultsByInstallVersion = param?.defaultsByInstallVersion
  if (defaultsByInstallVersion && key !== 'Comfy.InstalledVersion') {
    const installedVersion = get('Comfy.InstalledVersion')

    if (installedVersion) {
      const sortedVersions = Object.keys(defaultsByInstallVersion).sort(
        (a, b) => compare(b, a)
      )

      for (const version of sortedVersions) {
        if (!valid(version)) continue

        if (compare(installedVersion, version) >= 0) {
          const versionedDefault = defaultsByInstallVersion[version]
          if (versionedDefault !== undefined) {
            return typeof versionedDefault === 'function'
              ? versionedDefault()
              : versionedDefault
          }
        }
      }
    }
  }
  return null
}
```

Example versioned defaults from codebase:

```typescript
// From src/platform/settings/constants/coreSettings.ts
{
  id: 'Comfy.LinkRelease.Action',
  defaultValue: LinkReleaseTriggerAction.CONTEXT_MENU,
  defaultsByInstallVersion: {
    '1.24.1': LinkReleaseTriggerAction.SEARCH_BOX
  }
}

// Another versioned default example
{
  id: 'Comfy.LinkRelease.ActionShift',
  defaultValue: LinkReleaseTriggerAction.SEARCH_BOX,
  defaultsByInstallVersion: {
    '1.24.1': LinkReleaseTriggerAction.CONTEXT_MENU
  }
}

// A versioned default can also be computed from the build distribution
{
  id: 'Comfy.VueNodes.Enabled',
  defaultValue: false,
  defaultsByInstallVersion: { '1.41.0': isCloud || isDesktop }
}
```

### Real Examples from Codebase

Here are actual settings showing different patterns:

```typescript
// Number setting with validation
{
  id: 'LiteGraph.Node.TooltipDelay',
  name: 'Tooltip Delay',
  type: 'number',
  attrs: {
    min: 100,
    max: 3000,
    step: 50
  },
  defaultValue: 500,
  versionAdded: '1.9.0'
}

// Hidden system setting for tracking
{
  id: 'Comfy.InstalledVersion',
  name: 'The frontend version that was running when the user first installed ComfyUI',
  type: 'hidden',
  defaultValue: null,
  versionAdded: '1.24.0'
}

// Slider with a tooltip
{
  id: 'Comfy.Graph.AutoPanSpeed',
  category: ['LiteGraph', 'Canvas', 'AutoPanSpeed'],
  name: 'Auto-pan speed',
  tooltip: 'Maximum speed when auto-panning by dragging to the canvas edge. Set to 0 to disable auto-panning.',
  type: 'slider',
  defaultValue: 15,
  attrs: {
    min: 0,
    max: 30,
    step: 1
  }
}
```

### Deprecating a Setting

A setting that is no longer wired up is retired by marking it `deprecated` and
switching its `type` to `'hidden'` so it disappears from the settings UI while
existing persisted values stay readable:

```typescript
// From src/platform/settings/constants/coreSettings.ts
{
  id: 'LiteGraph.Canvas.LowQualityRenderingZoomThreshold',
  type: 'hidden',
  deprecated: true,
  name: 'Low quality rendering zoom threshold (deprecated)',
  defaultValue: 0.6,
  versionAdded: '1.9.1'
}
```

### New User Version Capture

The initial installed version is captured for new users to ensure versioned defaults remain stable:

```typescript
// From src/services/useNewUserService.ts
await settingStore.set('Comfy.InstalledVersion', __COMFYUI_FRONTEND_VERSION__)
```

## Practical Patterns for Environment-Based Defaults

### Dynamic Default Patterns

```typescript
// Device-based default
{
  id: 'Comfy.Example.MobileDefault',
  type: 'boolean',
  defaultValue: () => /Mobile/i.test(navigator.userAgent)
}

// Environment-based default
{
  id: 'Comfy.Example.DevMode',
  type: 'boolean',
  defaultValue: () => import.meta.env.DEV
}

// Window size based
{
  id: 'Comfy.Example.CompactUI',
  type: 'boolean',
  defaultValue: () => window.innerWidth < 1024
}
```

### Version-Based Rollout Pattern

```typescript
{
  id: 'Comfy.Example.NewFeature',
  type: 'combo',
  options: ['legacy', 'enhanced'],
  defaultValue: 'legacy',
  defaultsByInstallVersion: {
    '1.25.0': 'enhanced'
  }
}
```

## Settings Persistence and Access

### API Interaction

Values are stored per user via the backend. The store writes through API and falls back to defaults when not set:

The store is updated **before** `onChange` runs, so handlers that read the
setting back observe the new value. Persistence happens last:

```typescript
// From src/platform/settings/settingStore.ts
settingValues.value[key] = typedNewValue

await onChange(settingsById.value[key], newValue, oldValue)

// ... then, in set():
await api.storeSetting(key, applied.newValue)
```

### Usage in Components

```typescript
const settingStore = useSettingStore()

// Get setting value (returns computed default if not set by user)
const value = settingStore.get('Comfy.SomeSetting')

// Update setting value
await settingStore.set('Comfy.SomeSetting', newValue)
```

## Advanced Settings Features

### Migration and Backward Compatibility

Settings support migration from deprecated values:

```typescript
// From src/platform/settings/settingStore.ts
const newValue = tryMigrateDeprecatedValue(settingsById.value[key], clonedValue)

// Migration happens during addSetting for existing values:
if (settingValues.value[setting.id] !== undefined) {
  settingValues.value[setting.id] = tryMigrateDeprecatedValue(
    setting,
    settingValues.value[setting.id]
  )
}
```

### onChange Callbacks

A setting can define an `onChange` callback. It is extension-facing public API
and receives **the new value and the old value** — not the setting definition:

```typescript
// From src/platform/settings/types.ts
onChange?(newValue: TValue, oldValue?: TValue): void | Promise<void>
```

```typescript
{
  id: 'Comfy.Example.Setting',
  type: 'boolean',
  defaultValue: false,
  onChange: (newValue, oldValue) => {
    console.log(`changed from ${oldValue} to ${newValue}`)
  }
}
```

The store wraps it in an internal helper that also takes the setting definition
so it can log which handler failed. That helper fires in two places — once when
a value is set, and once when a setting is first registered so the handler sees
its initial value:

```typescript
// From src/platform/settings/settingStore.ts
await onChange(settingsById.value[key], newValue, oldValue) // during set()
void onChange(setting, get(setting.id), undefined) // during addSetting()
```

A throwing handler is caught and warned about rather than failing the write.

### Settings UI and Categories

Settings are automatically grouped for UI based on their `category` or derived from `id`:

```typescript
{
  id: 'Comfy.Sidebar.Size',
  category: ['Appearance', 'Sidebar', 'Size'],
  // UI will group this under Appearance > Sidebar > Size
}
```

## Related Documentation

- Feature flag system: `docs/FEATURE_FLAGS.md`
- Settings schema for backend: `src/schemas/apiSchema.ts` (zSettings)
- Server configuration (separate from user settings): `src/constants/serverConfig.ts`

## Summary

- **Settings**: User preferences with dynamic/versioned defaults, persisted per user
- **Environment Defaults**: Use function defaults to read runtime context (window, navigator, env)
- **Version Rollouts**: Use `defaultsByInstallVersion` for gradual feature releases
- **API Interaction**: Settings persist to `/settings` endpoint via `storeSetting()`

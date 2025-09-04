# Widget Integration Guide: Vue Components + LiteGraph

## Overview
This guide documents how to integrate Vue components with the LiteGraph widget system. The primary use case is replacing standard widgets (combo, text, number, etc.) with custom Vue components that provide enhanced UI experiences through any presentation pattern - inline editors, dropdowns, modals, overlays, or specialized controls.

**Common Use Cases:**
- Asset browsers with modal dialogs (checkpoints, LoRAs, VAEs, schedulers)
- Advanced text editors with inline syntax highlighting  
- Interactive parameter controls with dropdown sliders and presets
- File upload interfaces with drag-and-drop overlays
- Multi-select components with popup search and filtering
- Color pickers, date selectors, or other specialized input widgets

**Core Pattern:** This guide demonstrates the complete pattern using a modal asset browser example, but the same architectural principles apply to any widget replacement scenario regardless of presentation style (modal, inline, dropdown, overlay, etc.).

## Architecture Layers

```
┌─────────────────────────────────────┐
│           Vue App Layer             │
│  - YourCustomWidget.vue            │
│  - YourBrowserDialog.vue           │
│  - PrimeVue Components             │
└─────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────┐
│         Integration Layer           │
│  - useYourCustomWidget()           │
│  - ComponentWidgetImpl             │
│  - ComfyWidgets registry           │
└─────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────┐
│         LiteGraph Layer             │
│  - BaseWidget                      │
│  - Node widget system              │
│  - Graph canvas events             │
└─────────────────────────────────────┘
```

## Communication Flow Sequence

The following sequence diagram shows the complete communication pattern for widget value updates, using our working asset browser example:

```mermaid
sequenceDiagram
    participant U as User
    participant AW as AssetPickerWidget<br/>(Vue Component)
    participant AB as AssetBrowserDialog<br/>(Vue Component)
    participant CWI as ComponentWidgetImpl<br/>(Integration Layer)
    participant BW as BaseWidget<br/>(LiteGraph)
    participant N as LGraphNode<br/>(LiteGraph)
    participant C as LGraphCanvas<br/>(LiteGraph)

    Note over U,C: Widget Creation Phase
    N->>+CWI: new ComponentWidgetImpl({ props, options })
    CWI->>CWI: Configure setValue with<br/>canvas context
    CWI->>+AW: Mount Vue component with props
    AW-->>-CWI: Component ready
    CWI-->>-N: Widget created and registered

    Note over U,C: User Interaction Phase
    U->>+AW: Click browse button
    AW->>AW: showModal = true
    AW->>+AB: Modal opens with<br/>:on-select prop
    AB->>AB: Load and display assets
    U->>AB: Click asset item
    AB->>AB: onSelect(asset)
    AB->>-AW: Call props.onSelect(asset)
    
    Note over U,C: Value Update Phase  
    AW->>+AW: onAssetSelect(asset)
    AW->>AW: selectedAsset.value = asset
    AW->>AW: newValue = asset.filename
    AW->>+CWI: props.widget.setValue(newValue)
    
    Note over CWI: Canvas Context Resolution
    CWI->>CWI: canvas = globalThis.app?.canvas
    CWI->>CWI: syntheticEvent = new PointerEvent(...)
    CWI->>CWI: canvasEvent = Object.assign(...)
    
    CWI->>+BW: widget.setValue(newValue, {<br/>e: canvasEvent, node, canvas})
    BW->>BW: Update internal value
    BW->>BW: Call widget.callback()
    BW->>+N: node.onWidgetChanged()
    N->>N: Update node properties
    N-->>-BW: Node updated
    BW-->>-CWI: setValue complete
    CWI-->>-AW: Update successful
    
    Note over U,C: UI Update Phase
    AW->>AW: emit('update:modelValue')
    AW->>AW: showModal = false
    AW->>-AB: Modal closes
    
    Note over U,C: Final State
    Note over AW: Widget displays<br/>selected asset name
    Note over N: Node has new<br/>widget value
    Note over C: Graph version<br/>incremented
```

**Key Communication Patterns:**

1. **Props Flow Down**: ComponentWidgetImpl → Vue Component via `props`
2. **Events Flow Up**: Vue Component → ComponentWidgetImpl via configured `setValue`
3. **Canvas Context**: ComponentWidgetImpl manages LiteGraph integration
4. **Value Updates**: BaseWidget handles the actual value change with proper context
5. **UI Reactivity**: Vue components update automatically via reactive getters

## Widget Replacement Pattern

### 1. Create Widget Composable (`useAssetComboWidget.ts`)

**✅ WORKING PATTERN:**
```typescript
export const useAssetComboWidget = (): ComfyWidgetConstructorV2 => {
  const standardComboWidget = useComboWidget()
  
  return (node: LGraphNode, inputSpec: InputSpec) => {
    // Eligibility check
    const shouldUseAssetBrowser = checkAssetBrowserEligibility(node, inputSpec)
    
    if (shouldUseAssetBrowser) {
      return createAssetPickerWidget(node, inputSpec)
    }
    
    // Fallback to standard widget
    return standardComboWidget(node, inputSpec)
  }
}

// Widget creation using ComponentWidgetImpl
function createAssetPickerWidget(node: LGraphNode, inputSpec: ComboInputSpec) {
  const widgetValue = ref<string>(inputSpec.default || '')
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component: AssetPickerWidget,
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string) => {
        widgetValue.value = value
      },
      widget: {
        value: widgetValue.value,
        name: inputSpec.name,
        setValue: (value: string) => {
          widgetValue.value = value
        }
      }
    }
  })
  
  addWidget(node, widget as BaseDOMWidget<object | string>)
  return widget
}
```

**❌ BROKEN APPROACHES:**
- Direct DOM manipulation instead of ComponentWidgetImpl
- Modifying existing widgets in-place
- Intercepting at the UI level instead of widget system level

**Why These Approaches Fail:**

- **Direct DOM Manipulation**: Bypasses Vue's reactivity system and component lifecycle, leading to memory leaks, broken event handling, and state inconsistencies when the graph updates
- **In-Place Widget Modification**: LiteGraph widgets have complex initialization and cleanup procedures - modifying them after creation breaks their internal state management and event binding
- **UI-Level Interception**: Intercepting at the visual layer (like sidebar component) misses the fundamental widget replacement requirement - the graph canvas still creates standard widgets that conflict with the custom UI

### 2. Register Widget in System (`widgets.ts`)

**✅ WORKING PATTERN:**
```typescript
export const ComfyWidgets: Record<string, ComfyWidgetConstructor> = {
  // Replace COMBO with enhanced version
  COMBO: transformWidgetConstructorV2ToV1(useAssetComboWidget()),
  // ... other widgets
}
```

**❌ BROKEN APPROACHES:**
- Adding new widget types instead of replacing existing ones
- Conditional registration based on settings (breaks consistency)

**Why These Approaches Fail:**

- **Adding New Widget Types**: ComfyUI's node definitions specify widget types (COMBO, STRING, etc.) that map to the ComfyWidgets registry - adding new types means existing nodes won't use them because they still request the original widget type
- **Conditional Registration**: Settings-dependent widget registration creates inconsistent behavior where the same node definition produces different widgets depending on user settings, breaking reproducibility and extension compatibility

### 3. Vue Component Integration

**Example: Modal Dialog Presentation Pattern**

This demonstrates one common presentation approach - other patterns (inline editors, dropdowns, overlays) follow the same communication principles with different UI presentation.

**✅ WORKING MODAL PATTERN:**
```vue
<template>
  <div class="asset-picker-widget">
    <!-- Widget display -->
    <div class="selected-asset-display">
      <span class="asset-name">{{ displayName }}</span>
      <Button @click="openAssetBrowser" />
    </div>
    
    <!-- Modal wrapper - CRITICAL: Use PrimeVue Dialog -->
    <Dialog 
      v-model:visible="showModal"
      :modal="true"
      :style="{ width: '80vw', height: '80vh' }"
    >
      <AssetBrowserDialog 
        :onClose="closeAssetBrowser"
        :onSelect="onAssetSelect"
      />
    </Dialog>
  </div>
</template>
```

**❌ BROKEN MODAL-SPECIFIC APPROACHES:**
- Rendering modal content inline (shows as small popup instead of full-screen overlay)
- Using `@select` event instead of `:onSelect` prop (prop vs event mismatch)  
- Missing Dialog wrapper component (breaks proper modal display)

**Why Modal-Specific Failures Occur:**
- **Inline Content**: Without Dialog wrapper, content renders in the normal document flow instead of as an overlay
- **Event vs Prop**: AssetBrowserDialog expects function props, not Vue events - the communication pattern must match what the receiving component expects
- **Missing Wrapper**: PrimeVue modals require specific Dialog component structure for proper z-index, backdrop, and sizing behavior

## Alternative Presentation Patterns

The core ComponentWidgetImpl communication pattern works with any Vue component presentation approach:

**🎯 Inline Editor Pattern:**
```vue
<template>
  <div class="inline-text-editor">
    <textarea 
      v-model="localValue" 
      @blur="updateWidgetValue"
      class="syntax-highlighted-editor"
    />
    <!-- Inline syntax highlighting, autocomplete, etc. -->
  </div>
</template>
```

**🎯 Dropdown Selector Pattern:**  
```vue
<template>
  <div class="dropdown-widget">
    <Button @click="showDropdown = !showDropdown">{{ displayValue }}</Button>
    <div v-if="showDropdown" class="dropdown-panel">
      <!-- Custom dropdown content with search, filtering, etc. -->
    </div>
  </div>
</template>
```

**🎯 Overlay Pattern:**
```vue
<template>
  <div class="overlay-widget">
    <input @focus="showOverlay = true" readonly :value="displayValue" />
    <Teleport to="body">
      <div v-if="showOverlay" class="custom-overlay">
        <!-- Color picker, file browser, etc. -->
      </div>
    </Teleport>
  </div>
</template>
```

**Common Pattern Elements:**
- **ComponentWidgetImpl structure remains identical** regardless of presentation
- **setValue communication** follows the same canvas context pattern
- **Props interface** stays consistent (widget.value, widget.setValue, etc.)
- **Only the Vue template and styling change** - the integration layer is universal

## ComponentWidgetImpl Structure Patterns

### ⚠️ CRITICAL: Props vs Options Distinction

The ComponentWidgetImpl uses two separate parameter objects: `options` for internal widget behavior and `props` for Vue component properties.

**Why This Separation Exists:**

ComponentWidgetImpl bridges two different systems that have different data requirements:

1. **DOM Widget System** (uses `options`): The underlying DOM widget infrastructure expects getValue/setValue functions for managing widget state within the LiteGraph system
2. **Vue Component System** (uses `props`): Vue components expect reactive data props that can trigger re-renders when values change

**Why Mixing Them Fails:**
If you put Vue component props in the `options` object, the DOM widget system tries to interpret them as widget configuration, leading to type errors and failed widget initialization. If you put DOM widget functions in `props`, Vue components receive non-reactive function references instead of the data they need for rendering.

**✅ WORKING: Proper ComponentWidgetImpl Structure**
```typescript
function createAssetPickerWidget(node: LGraphNode, inputSpec: ComboInputSpec) {
  const widgetValue = ref<string>(inputSpec.default || '')
  
  const widget = new ComponentWidgetImpl({
    node,
    name: inputSpec.name,
    component: AssetPickerWidget,
    inputSpec,
    // OPTIONS: Internal widget behavior (for DOM widget system)
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: string) => {
        widgetValue.value = value
        console.log('🔧 Widget value updated to:', value)
      }
    },
    // PROPS: Passed to Vue component (this is what your Vue component receives)
    props: {
      widget: {
        // ✅ CRITICAL: Use getter for reactivity in Vue component
        get value() { return widgetValue.value },
        name: inputSpec.name,
        setValue: (newValue: string) => {
          // Proper setValue implementation with canvas context
          const globalApp = globalThis as { app?: { canvas?: LGraphCanvas } }
          const canvas = globalApp.app?.canvas
          
          if (!canvas) {
            throw new Error('Canvas is required for setValue operation')
          }

          // Create synthetic CanvasPointerEvent
          const syntheticPointerEvent = new PointerEvent('pointerdown', {
            bubbles: false,
            cancelable: false,
            pointerId: -1,
            pointerType: 'mouse'
          })
          
          const canvasEvent = Object.assign(syntheticPointerEvent, {
            canvasX: 0,
            canvasY: 0,
            deltaX: 0,
            deltaY: 0,
            safeOffsetX: 0,
            safeOffsetY: 0
          })
          
          // Call inherited setValue with proper WidgetEventOptions context
          widget.setValue(newValue, {
            e: canvasEvent,
            node: node,
            canvas: canvas
          })
        }
      },
      nodeType: node.type || 'unknown',
      widgetName: inputSpec.name
    }
  })
  
  addWidget(node, widget as BaseDOMWidget<object | string>)
  return widget
}
```

**❌ BROKEN: Mixing Props and Options**
```typescript
// DON'T put Vue component props in options
options: {
  getValue: () => widgetValue.value,
  widget: { /* This belongs in props! */ }
}
```

**Why This Fails:**
The `options` object is consumed by the DOM widget infrastructure, which expects specific function signatures for getValue/setValue. When you put Vue component props in `options`, the DOM widget system tries to interpret them as widget configuration functions, causing type mismatches and initialization failures.

**❌ BROKEN: Static Value in Props**
```typescript
props: {
  widget: {
    value: widgetValue.value,  // Snapshot - never updates!
    name: inputSpec.name
  }
}
```

**Why This Fails:**
`widgetValue.value` is evaluated once at ComponentWidgetImpl creation time, creating a static snapshot. When the underlying `widgetValue` ref changes, the Vue component never sees the updates because it only received the initial value, not a reactive reference to the current value. This breaks the reactive data flow that Vue components depend on for re-rendering.

## Communication Patterns

### Vue → LiteGraph (Widget Value Updates)

**✅ WORKING: Proper setValue with Canvas Context**
```typescript
const onAssetSelect = (asset: Asset) => {
  console.log('🎯 Asset selected in picker widget:', asset.name)
  selectedAsset.value = asset
  
  // Use the setValue method provided in props (this has proper canvas context)
  const newValue = asset.filename || asset.name
  console.log('🔧 Setting widget value to:', newValue)
  
  props.widget.setValue(newValue)
  console.log('✅ Widget value set via setValue with canvas context')
  
  // Emit update for Vue reactivity
  emit('update:modelValue', newValue)
  
  console.log('🔄 Modal should close now via onClose callback')
}
```

**✅ WORKING: Vue Component Props Interface**
```typescript
export interface AssetPickerWidgetProps {
  widget: {
    value: string                          // Current widget value (reactive)
    name: string                          // Widget name
    setValue: (newValue: string) => void  // Properly configured setValue function
  }
  nodeType?: string
  widgetName?: string
}
```

**❌ BROKEN: Calling setValue Without Proper Canvas Context**
```typescript
// This fails because setValue needs WidgetEventOptions
widget.setValue(newValue, {
  e: undefined,     // ❌ Invalid - needs proper CanvasPointerEvent  
  node: undefined,  // ❌ Invalid - needs actual LGraphNode
  canvas: undefined // ❌ Invalid - needs actual LGraphCanvas
})
```

**Why This Fails:**
BaseWidget.setValue immediately destructures the WidgetEventOptions parameter (`{ e, node, canvas }`) and then:

1. **Accesses Event Properties**: Tries to read `e.canvasX`, `e.deltaX`, etc. - if `e` is undefined, this throws "Cannot read properties of undefined"
2. **Calls Canvas Methods**: Invokes `canvas.graph_mouse` and other canvas methods - if `canvas` is undefined, this throws TypeError  
3. **Updates Node State**: Uses `node.setProperty()` and `node.onWidgetChanged()` - if `node` is undefined, these calls fail
4. **Graph Version Updates**: Accesses `node.graph._version` for change tracking - requires valid node and graph references

**Why Our setValue Works:**

Our approach succeeds because we provide all required context:

- **Canvas Context**: Obtained via `globalThis.app?.canvas` - the reliable ComfyUI architecture path
- **Complete Event**: Synthetic CanvasPointerEvent with all properties that LiteGraph expects (canvasX, deltaX, safeOffsetX, etc.)
- **Node Reference**: Actual LGraphNode passed from widget creation context
- **Proper Integration**: Uses the LiteGraph widget system's expected data flow instead of bypassing it

### LiteGraph → Vue (Props Flow)

**✅ WORKING: Reactive Props via ComponentWidgetImpl**
```typescript
// In ComponentWidgetImpl props (what Vue component receives)
props: {
  widget: {
    // ✅ Reactive getter - updates when widgetValue.value changes
    get value() { return widgetValue.value },
    name: inputSpec.name,
    setValue: (newValue: string) => {
      // Properly configured with canvas context
    }
  },
  nodeType: node.type || 'unknown',
  widgetName: inputSpec.name
}

// Vue component receives these props automatically
const props = withDefaults(defineProps<AssetPickerWidgetProps>(), {
  nodeType: '',
  widgetName: ''
})
```

**Why Reactive Getters Work:**

The `get value()` pattern creates a reactive property that:

1. **Reactive Updates**: Each time the Vue component accesses `props.widget.value`, it re-executes the getter function, reading the current `widgetValue.value`
2. **Dependency Tracking**: Vue's reactivity system automatically tracks that this component depends on `widgetValue`, so when `widgetValue` changes, the component re-renders
3. **Fresh Data**: Unlike static assignment (`value: widgetValue.value`), the getter always returns the current state, not a stale snapshot
4. **Performance**: Getters are only called when the property is accessed, avoiding unnecessary computation during widget initialization

### Component Communication Flow

This pattern works regardless of presentation style (modal, dropdown, inline, etc.).

**✅ WORKING: Prop chain pattern**
```
User clicks asset → AssetBrowserDialog.onSelect() 
     ↓ calls prop
AssetPickerWidget.onAssetSelect() 
     ↓ calls 
props.widget.setValue(newValue)
     ↓ triggers
BaseWidget.setValue() with proper canvas context
     ↓ updates
Node value + triggers callbacks + modal closes
```

**✅ WORKING: Prop-based modal communication**
```vue
<AssetBrowserDialog 
  :on-close="closeAssetBrowser"
  :on-select="onAssetSelect"  
/>
<!-- ✅ Using :on-select prop, not @select event -->
```

**❌ BROKEN: Event-based communication**
```vue
<!-- This doesn't work - prop vs event mismatch -->
<AssetBrowserDialog @select="onAssetSelect" />
```

**Why This Fails:**
AssetBrowserDialog is designed to receive callback functions as props (`:on-select`), not to emit Vue events (`@select`). When you use `@select`, Vue tries to listen for a custom event that AssetBrowserDialog never emits, so the communication chain breaks and asset selection never reaches the widget setValue.

## Eligibility Detection

**✅ WORKING: Widget name pattern matching**
```typescript
function checkAssetBrowserEligibility(node: LGraphNode, inputSpec: ComboInputSpec): boolean {
  // Focus on widget patterns rather than node types
  if (!isModelSelectionWidget(inputSpec)) {
    return false
  }
  
  // Optional: node type check as secondary filter
  if (node.type && node.type !== 'CheckpointLoaderSimple') {
    return false
  }
  
  return true
}

function isModelSelectionWidget(inputSpec: ComboInputSpec): boolean {
  const modelWidgetNames = ['ckpt_name', 'model_name', 'checkpoint']
  return modelWidgetNames.some(pattern => 
    inputSpec.name.toLowerCase().includes(pattern)
  )
}
```

**❌ BROKEN: Store-dependent eligibility**
```typescript
// This can cause initialization issues
const shouldUse = assetStore.isAssetApiAvailable.value
```

**Why This Fails:**
Widget creation happens during node initialization, which occurs early in the application lifecycle. At this time:

1. **Store Dependencies**: Pinia stores may not be fully initialized or may have async initialization logic still running
2. **API State**: Store values like `isAssetApiAvailable` depend on async API calls that may not have completed
3. **Inconsistent Behavior**: The same node type might get different widget types depending on timing, breaking user expectations
4. **Debugging Complexity**: Store-dependent eligibility creates hard-to-reproduce bugs where widget behavior varies based on load timing

**Why Pattern-Based Eligibility Works:**
Widget name patterns (`ckpt_name`, `model_name`) are static properties of the node definition that are always available during widget creation, making eligibility detection reliable and predictable.

## Common Errors & Solutions

### 1. "Cannot destructure property 'e' of 'undefined'" / "Cannot read properties of undefined (reading 'graph_mouse')"
**Cause:** Calling setValue without proper WidgetEventOptions context  
**Root Issue:** BaseWidget.setValue expects complete WidgetEventOptions with valid canvas context  
**✅ Solution:** Configure setValue properly in ComponentWidgetImpl props:
```typescript
props: {
  widget: {
    setValue: (newValue: string) => {
      // Get canvas from global ComfyUI app instance
      const globalApp = globalThis as { app?: { canvas?: LGraphCanvas } }
      const canvas = globalApp.app?.canvas
      
      if (!canvas) {
        throw new Error('Canvas is required for setValue operation')
      }

      // Create synthetic CanvasPointerEvent
      const syntheticPointerEvent = new PointerEvent('pointerdown', {
        bubbles: false, cancelable: false, pointerId: -1, pointerType: 'mouse'
      })
      
      const canvasEvent = Object.assign(syntheticPointerEvent, {
        canvasX: 0, canvasY: 0, deltaX: 0, deltaY: 0, safeOffsetX: 0, safeOffsetY: 0
      })
      
      // Call with proper WidgetEventOptions
      widget.setValue(newValue, { e: canvasEvent, node: node, canvas: canvas })
    }
  }
}
```

### 2. **Widget value doesn't update reactively in UI**
**Cause:** Using static value assignment in ComponentWidgetImpl props: `value: widgetValue.value`  
**Root Issue:** Creates snapshot at creation time, never updates when underlying ref changes  
**✅ Solution:** Use getter pattern in props:
```typescript
props: {
  widget: {
    get value() { return widgetValue.value },  // ✅ Reactive
    name: inputSpec.name
  }
}
```

### 3. **TypeScript errors: "Property 'canvas' does not exist on type 'LGraph'"**  
**Cause:** Trying to access `node.graph?.canvas` which doesn't exist on LGraph type  
**Root Issue:** Canvas is not a direct property of LGraph  
**✅ Solution:** Use global app access:
```typescript
const globalApp = globalThis as { app?: { canvas?: LGraphCanvas } }
const canvas = globalApp.app?.canvas
```

### 4. **Modal shows as small popup instead of full screen**
**Cause:** Missing PrimeVue Dialog wrapper component
**✅ Solution:** Wrap content in `<Dialog>` with proper sizing:
```vue
<Dialog 
  v-model:visible="showModal"
  :modal="true"
  :style="{ width: '80vw', height: '80vh' }"
>
  <YourBrowserComponent />
</Dialog>
```

### 5. **Modal doesn't close on selection**
**Cause:** Prop vs event communication mismatch
**✅ Solution:** Use `:on-select` prop instead of `@select` event:
```vue
<AssetBrowserDialog 
  :on-close="closeModal"
  :on-select="onSelect"  
/>
```

### 6. **ESLint/TypeScript violations: "NEVER use 'as any' type assertions"**
**Cause:** Using `as any` to bypass type checking (violates CLAUDE.md guidelines)  
**Root Issue:** Improper typing approaches  
**✅ Solution:** Use proper typing strategies:
```typescript
// ❌ Wrong
const canvas = (globalThis as any).app.canvas

// ✅ Correct  
const globalApp = globalThis as { app?: { canvas?: LGraphCanvas } }
const canvas = globalApp.app?.canvas
```

### 7. **ComponentWidgetImpl structure confusion**
**Cause:** Mixing `options` and `props` parameters  
**Root Issue:** Not understanding the two-parameter structure  
**✅ Solution:** Use proper parameter separation:
```typescript
new ComponentWidgetImpl({
  // ... basic params
  options: {        // Internal widget behavior
    getValue: () => widgetValue.value,
    setValue: (v) => widgetValue.value = v
  },
  props: {          // What Vue component receives
    widget: { /* props for Vue */ }
  }
})
```

## Testing Strategy

### **⚠️ CRITICAL: Complete Flow Testing**

Always test the **ENTIRE user flow** - widget creation through final value persistence. Partial testing misses critical integration issues.

**✅ Complete Testing Sequence:**
1. **Widget Creation**: `window.LiteGraph.createNode('CheckpointLoaderSimple')`
2. **Widget Replacement Verification**: Check console for widget replacement logs
3. **Modal Opening**: Click browse button, verify 80vw x 80vh modal opens
4. **Asset Selection**: Click asset, verify no console errors
5. **Value Updates**: Confirm widget value updates to selected asset
6. **Modal Closing**: Verify modal automatically closes after selection
7. **Reactivity**: Confirm UI displays updated asset name

**Essential Console Log Pattern (Complete Success Flow):**
```
✅ Complete success flow from our working implementation:
🔧 useAssetComboWidget called for: {nodeType: CheckpointLoaderSimple, inputName: ckpt_name, inputType: COMBO}
✅ Eligible for asset browser enhancement for: ckpt_name  
🎯 Creating AssetPickerWidget for: CheckpointLoaderSimple ckpt_name
🎯 Opening asset browser for widget: ckpt_name
🎯 Asset selected in picker widget: Realistic Vision V5.1
🔧 AssetPickerWidget setValue called with: realisticVisionV51_v51VAE.safetensors
✅ Widget setValue called with proper context
✅ Widget value set via setValue with canvas context
🎯 closeAssetBrowser called for widget: ckpt_name
✅ Modal should be closed now, showModal.value = false

❌ Critical error indicators (should NOT appear):
- Cannot destructure property 'e' of 'undefined'
- Canvas is required for setValue operation (without proper context)
- TypeError: Cannot read properties of undefined (reading 'graph_mouse')
- Modal remains open after asset selection
- Widget value doesn't update in UI after selection
- ESLint errors about 'as any' type assertions

🎯 Key success indicators:
- "Widget setValue called with proper context" ✅
- "Widget value set via setValue with canvas context" ✅  
- Modal closes automatically after selection ✅
- No TypeScript or ESLint errors ✅
```

### **Debug Strategy**
When issues occur, add comprehensive console logs:

```typescript
// In onAssetSelect
console.log('🎯 Asset selected:', asset.name)
console.log('🔧 Setting widget value to:', newValue)
console.log('✅ Widget value set via direct assignment')
console.log('🔄 Modal should close now via onClose callback')

// In closeAssetBrowser  
console.log('🎯 closeAssetBrowser called')
console.log('✅ Modal should be closed now, showModal.value =', showModal.value)
```

## Key Files Reference

- `/src/composables/widgets/useAssetComboWidget.ts` - Widget replacement logic
- `/src/scripts/widgets.ts` - Widget registry
- `/src/components/graph/widgets/AssetPickerWidget.vue` - Vue widget component
- `/src/scripts/domWidget.ts` - ComponentWidgetImpl implementation
- `/src/lib/litegraph/src/widgets/BaseWidget.ts` - Base widget setValue behavior

## Critical Success Patterns Summary

### **🎯 The Golden Rules**

1. **ALWAYS use ComponentWidgetImpl with proper props/options structure** - separates Vue props from widget behavior
2. **ALWAYS configure setValue in props with proper canvas context** - enables proper LiteGraph integration  
3. **ALWAYS use getter pattern for reactive values** - `get value() { return widgetValue.value }`
4. **ALWAYS test the complete user flow** - partial testing misses integration issues
5. **NEVER use `as any` type assertions** - follow TypeScript compliance patterns

### **🔧 Essential Code Patterns**

**Widget Creation (ComponentWidgetImpl Structure):**
```typescript
const widget = new ComponentWidgetImpl({
  node, name: inputSpec.name, component: YourComponent, inputSpec,
  options: {                    // Internal widget behavior
    getValue: () => widgetValue.value,
    setValue: (v) => widgetValue.value = v
  },
  props: {                      // Vue component props
    widget: {
      get value() { return widgetValue.value },  // Reactive getter
      name: inputSpec.name,
      setValue: (newValue: string) => {
        // Proper setValue with canvas context (see Canvas Access Patterns)
        const canvas = getCanvasFromGlobalApp()
        const canvasEvent = createSyntheticPointerEvent()
        widget.setValue(newValue, { e: canvasEvent, node, canvas })
      }
    }
  }
})
```

**Value Updates (Proper setValue Call):**
```typescript
// In Vue component - use the configured setValue
props.widget.setValue(newValue)  // ✅ Has proper canvas context
```

**Modal Integration (PrimeVue Dialog):**
```vue
<Dialog v-model:visible="showModal" :style="{ width: '80vw', height: '80vh' }">
  <YourBrowserComponent :on-close="closeModal" :on-select="onSelect" />
</Dialog>
```

## Canvas Access Patterns

### **🎯 CRITICAL: Accessing Canvas Context for setValue**

The most common failure point in widget integration is accessing canvas context. The setValue method requires proper canvas context through WidgetEventOptions.

**✅ WORKING: Global App Canvas Access**
```typescript
function getCanvasFromGlobalApp(): LGraphCanvas {
  const globalApp = globalThis as { app?: { canvas?: LGraphCanvas } }
  const canvas = globalApp.app?.canvas
  
  if (!canvas) {
    throw new Error('Canvas is required for setValue operation')
  }
  
  return canvas
}
```

**✅ WORKING: Synthetic CanvasPointerEvent Creation**
```typescript
function createSyntheticPointerEvent(): CanvasPointerEvent {
  // Create base PointerEvent
  const syntheticPointerEvent = new PointerEvent('pointerdown', {
    bubbles: false,
    cancelable: false,
    pointerId: -1,
    pointerType: 'mouse'
  })
  
  // Add required canvas properties
  const canvasEvent = Object.assign(syntheticPointerEvent, {
    canvasX: 0,      // X coordinate in graph space
    canvasY: 0,      // Y coordinate in graph space  
    deltaX: 0,       // Delta movement X
    deltaY: 0,       // Delta movement Y
    safeOffsetX: 0,  // Firefox workaround offset X
    safeOffsetY: 0   // Firefox workaround offset Y
  })
  
  return canvasEvent as CanvasPointerEvent
}
```

**Why Synthetic Events Are Necessary:**

The BaseWidget.setValue method in LiteGraph expects a complete WidgetEventOptions object with three required properties: `e` (CanvasPointerEvent), `node` (LGraphNode), and `canvas` (LGraphCanvas). This requirement exists because:

1. **Real User Events**: When users interact with widgets directly (clicking, dragging), LiteGraph automatically provides real PointerEvents that get extended with canvas-specific properties
2. **Programmatic Calls**: When Vue components call setValue programmatically (like asset selection), there is no real user event - we're triggering the setValue from code
3. **Required Event Properties**: BaseWidget.setValue attempts to destructure the event object (`{ e, node, canvas }`) and access properties like `e.canvasX` and calls methods like `canvas.graph_mouse` - if any of these are undefined, setValue fails

**Why These Specific Properties Are Required:**

- `canvasX/canvasY`: Graph-space coordinates used by LiteGraph for positioning and hit detection
- `deltaX/deltaY`: Movement deltas used for drag operations and gesture recognition  
- `safeOffsetX/safeOffsetY`: Firefox-specific workarounds for browser offset calculation bugs
- All properties must be numbers (not undefined) because BaseWidget and canvas methods perform calculations with them

**Why Object.assign Works:**
Object.assign creates a proper CanvasPointerEvent by extending the base PointerEvent with canvas-specific properties, maintaining the event's prototype chain while adding the required fields that LiteGraph expects.
```

**✅ WORKING: Complete setValue Implementation**
```typescript
// In ComponentWidgetImpl props
setValue: (newValue: string) => {
  const canvas = getCanvasFromGlobalApp()
  const canvasEvent = createSyntheticPointerEvent()
  
  // Call BaseWidget.setValue with proper WidgetEventOptions
  widget.setValue(newValue, {
    e: canvasEvent,
    node: node,
    canvas: canvas
  })
}
```

**❌ BROKEN: Failed Canvas Access Attempts**
```typescript
// These paths don't work:
const canvas = node.graph?.canvas           // ❌ Property doesn't exist on LGraph
const canvas = node.graph.list_of_graphcanvas?.[0]  // ❌ Unreliable
const canvas = someStore.getCanvas()        // ❌ Store dependency issues
```

### **Why Global App Access Works:**

**ComfyUI Architecture Context:**
ComfyUI follows a centralized application pattern where the global `app` object serves as the main application controller. This architecture choice exists because:

1. **Single Canvas Pattern**: ComfyUI typically runs with one primary graph canvas that handles all node interactions
2. **Global State Management**: The app object centralizes access to core services like the canvas, API client, and UI state  
3. **Extension Compatibility**: Many ComfyUI extensions and custom nodes rely on `globalThis.app` access patterns
4. **Lifecycle Reliability**: The global app instance is initialized early and persists throughout the application lifecycle

**Why Alternative Approaches Fail:**

- `node.graph?.canvas`: **Fails because LGraph type doesn't have a canvas property** - the graph object represents the node connection data, not the visual canvas that renders it
- `node.graph.list_of_graphcanvas?.[0]`: **Unreliable because this is an internal LiteGraph array** that may be empty, have multiple canvases, or change unexpectedly during graph operations
- `someStore.getCanvas()`: **Creates circular dependencies and initialization order issues** - stores may not be initialized when widgets are created, and store-based canvas access can fail during early widget creation phases

**Why globalThis.app?.canvas Works:**
This approach succeeds because it directly accesses ComfyUI's established architecture pattern that's guaranteed to be available when widget setValue operations occur.

## TypeScript Compliance Patterns

### **🚨 CRITICAL: Avoiding `as any` Type Assertions**

Following CLAUDE.md guidelines, we must avoid `as any` type assertions while maintaining proper typing.

**✅ WORKING: Proper Global Typing**
```typescript
// Define the shape we expect from globalThis
const globalApp = globalThis as { app?: { canvas?: LGraphCanvas } }
const canvas = globalApp.app?.canvas
```

**✅ WORKING: Structured Type Assertion**
```typescript
// For PointerEvent extension
const syntheticEvent = new PointerEvent('pointerdown', { /* ... */ })
const canvasEvent = Object.assign(syntheticEvent, {
  canvasX: 0, canvasY: 0, deltaX: 0, deltaY: 0,
  safeOffsetX: 0, safeOffsetY: 0
}) as CanvasPointerEvent  // Safe - we're adding the required properties
```

**❌ BROKEN: Type Assertion Violations**
```typescript
const app = (globalThis as any).app        // ❌ Violates CLAUDE.md rules
const canvas = app.canvas                  // ❌ No type safety
const event = {} as CanvasPointerEvent     // ❌ Empty object cast
```

**Why `as any` Assertions Fail in This Codebase:**

The CLAUDE.md guidelines prohibit `as any` assertions because they:

1. **Break Type Safety**: Disable TypeScript's ability to catch type errors at compile time, leading to runtime failures
2. **Cause Runtime Errors**: Properties and methods accessed through `as any` may not exist, causing "Cannot read properties of undefined" errors
3. **Break IDE Support**: IntelliSense, autocomplete, and refactoring tools can't work with `any` types
4. **Hide Integration Issues**: Type errors often indicate real architectural problems that need proper solutions, not type casting workarounds

**Why Structured Type Assertions Work:**

Our structured approach (`globalThis as { app?: { canvas?: LGraphCanvas } }`) succeeds because:

- **Preserves Type Information**: TypeScript can still validate the expected structure
- **Enables Safe Access**: Optional chaining (`app?.canvas`) handles cases where properties don't exist  
- **Maintains IDE Support**: Full autocomplete and type checking for accessed properties
- **Self-Documenting**: The type assertion clearly shows what structure we expect from globalThis

### **Type Import Requirements**
```typescript
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'  // If using the type
```

## Best Practices

1. **Always use ComponentWidgetImpl** for Vue component integration
2. **Replace existing widget types** rather than creating new ones  
3. **Use getter/setter pattern** for reactive widget values that support assignment
4. **Direct widget.value assignment** for programmatic updates (with lint suppression)
5. **Prop-based communication** between components, not events
6. **Pattern-based eligibility** rather than store-dependent logic
7. **Comprehensive console logging** for debugging complete widget lifecycle
8. **Test complete user flows** from node creation through final value persistence
9. **Use PrimeVue Dialog** for modal overlays with proper 80vw x 80vh sizing

### **🚨 Avoid These Anti-Patterns**
- ❌ Static value snapshots: `value: widgetValue.value`
- ❌ Read-only computed refs: `value: computed(() => widgetValue.value)`  
- ❌ Direct prop mutations without proper setValue
- ❌ Partial flow testing: Always test the complete user journey
- ❌ Using `as any` type assertions (violates CLAUDE.md guidelines)

## Adapting This Pattern to Other Widget Types

### **🎯 Generic Application Guide**

This asset browser example demonstrates the complete pattern, but you can adapt it for any widget replacement:

**1. LoRA Selector Widget:**
```typescript
// Eligibility: target 'lora_name' widgets
function isLoRASelectionWidget(inputSpec: ComboInputSpec): boolean {
  return ['lora_name', 'lora', 'adapter'].some(pattern => 
    inputSpec.name.toLowerCase().includes(pattern)
  )
}

// Component: LoRAPickerWidget.vue with modal LoRABrowser
// Same ComponentWidgetImpl structure, different UI content
```

**2. Advanced Text Editor Widget:**
```typescript
// Eligibility: target large text inputs
function isAdvancedTextWidget(inputSpec: InputSpec): boolean {
  return inputSpec.type === 'STRING' && 
         (inputSpec.multiline || inputSpec.name.includes('prompt'))
}

// Component: AdvancedTextEditor.vue with syntax highlighting
// No modal - inline editor with expanded features
```

**3. Color Picker Widget:**
```typescript  
// Eligibility: target color-related widgets
function isColorWidget(inputSpec: InputSpec): boolean {
  return inputSpec.type === 'STRING' && 
         inputSpec.name.toLowerCase().includes('color')
}

// Component: ColorPickerWidget.vue with color palette
// Props: widget.setValue for hex color values
```

### **🔧 Universal Adaptation Steps**

**Step 1: Widget Replacement Logic**
```typescript
export const useYourCustomWidget = (): ComfyWidgetConstructorV2 => {
  const standardWidget = useStandardWidget() // Whatever you're replacing
  
  return (node: LGraphNode, inputSpec: InputSpec) => {
    if (shouldUseCustomWidget(node, inputSpec)) {
      return createYourCustomWidget(node, inputSpec)
    }
    return standardWidget(node, inputSpec)
  }
}
```

**Step 2: Eligibility Function**
```typescript
function shouldUseCustomWidget(node: LGraphNode, inputSpec: InputSpec): boolean {
  // Adapt these conditions to your use case:
  const matchesWidgetPattern = /* your widget name/type pattern */
  const matchesNodeType = /* your target node types */
  const hasRequiredFeatures = /* any other conditions */
  
  return matchesWidgetPattern && matchesNodeType && hasRequiredFeatures
}
```

**Step 3: Component Creation**  
```typescript
function createYourCustomWidget(node: LGraphNode, inputSpec: InputSpec) {
  const widgetValue = ref<YourValueType>(inputSpec.default || '')
  
  const widget = new ComponentWidgetImpl({
    node, name: inputSpec.name,
    component: YourCustomComponent,  // Your Vue component
    inputSpec,
    options: {
      getValue: () => widgetValue.value,
      setValue: (value: YourValueType) => widgetValue.value = value
    },
    props: {
      widget: {
        get value() { return widgetValue.value },
        name: inputSpec.name,
        setValue: (newValue: YourValueType) => {
          // Same canvas access pattern for any widget type
          const canvas = getCanvasFromGlobalApp()
          const canvasEvent = createSyntheticPointerEvent()
          widget.setValue(newValue, { e: canvasEvent, node, canvas })
        }
      },
      // Add your component-specific props
      customProp1: /* your value */,
      customProp2: /* your value */
    }
  })
  
  addWidget(node, widget as BaseDOMWidget<object | string>)
  return widget
}
```

**Step 4: Vue Component Interface**
```typescript
export interface YourCustomWidgetProps {
  widget: {
    value: YourValueType
    name: string  
    setValue: (newValue: YourValueType) => void
  }
  // Your component-specific props
  customProp1?: YourType1
  customProp2?: YourType2
}
```

### **Key Principles (Universal)**

1. **ComponentWidgetImpl Structure**: Always separate `options` (internal) from `props` (Vue component)
2. **Canvas Context**: Always use the same canvas access pattern for setValue
3. **Reactive Values**: Always use getter pattern for reactive widget values
4. **TypeScript Compliance**: Always avoid `as any` type assertions
5. **Complete Testing**: Always test the full user interaction flow

These patterns work for **any** widget type - the architecture remains the same whether you're building asset browsers, text editors, color pickers, or any other custom widget interface.
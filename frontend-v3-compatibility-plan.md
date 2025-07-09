# Frontend V3 Compatibility Layer Implementation Plan (Import-Based API Versioning)

## Overview

This document outlines an **import-based API versioning** approach for implementing v3 compatibility in the ComfyUI frontend. This approach provides **type-safe API versioning** through import-based version selection, **dual endpoint data fetching**, and **proxy-based data synchronization**. Extensions choose their API version at import time, ensuring compile-time type safety and backward compatibility.

## Key Design Principles

1. **Import-Based Version Selection**: Extensions choose API version through import statements
2. **Type-Safe API Surfaces**: Compile-time type checking for each API version
3. **Dual Endpoint Fetching**: Simultaneous fetching from current and v3 endpoints
4. **Proxy-Based Synchronization**: Bidirectional data sync between API versions
5. **Zero Breaking Changes**: Existing extensions continue to work unchanged
6. **Gradual Migration**: Developers can adopt new versions incrementally

## Architecture Overview

### 1. Import-Based API Version Selection

Extensions import the API version they want to use, getting typed interfaces and guaranteed compatibility:

```typescript
// Legacy extensions (unchanged)
import { app } from '@/scripts/app'

// Version-specific imports
import { app } from '@/scripts/app/v1'           // v1.x API
import { app } from '@/scripts/app/v1_2'         // v1.2 API  
import { app } from '@/scripts/app/v2'           // v2.x API
import { app } from '@/scripts/app/latest'       // Latest/bleeding edge
import { app } from '@/scripts/app'              // Defaults to latest

// Full version-specific imports
import { app, extensionManager, api } from '@/scripts/app/v1_2'

// Extensions get typed, version-specific interfaces
app.registerExtension({
  name: 'MyExtension',
  beforeRegisterNodeDef(nodeType, nodeData: ComfyNodeDefV1_2, app: ComfyAppV1_2) {
    // nodeData is guaranteed to be in v1.2 format
    // app methods are v1.2 compatible
  }
})
```

### 2. Dual Endpoint Data Fetching

The system fetches data from both current and future API endpoints simultaneously:

```typescript
// Fetch from multiple endpoints
const fetchNodeDefinitions = async () => {
  const [currentResponse, v3Response] = await Promise.allSettled([
    api.get('/object_info'),      // Current format
    api.get('/v3/object_info')    // V3 format (when available)
  ])
  
  // Store all formats
  return {
    canonical: mergeToCanonical(currentResponse, v3Response),
    v1: transformToV1(currentResponse),
    v1_2: transformToV1_2(currentResponse),
    v3: v3Response || transformToV3(currentResponse)
  }
}
```

### 3. Proxy-Based Data Synchronization

Proxies ensure that changes made through any API version stay synchronized:

```typescript
// Extension modifies node data through v1.2 API
const createV1_2NodeDefProxy = (canonicalNodeDef: ComfyNodeDefLatest) => {
  return new Proxy({}, {
    get(target, prop) {
      // Map v1.2 property access to canonical format
      if (prop === 'input') {
        return transformLatestToV1_2Input(canonicalNodeDef.inputs)
      }
      return canonicalNodeDef[mapV1_2PropToLatest(prop)]
    },
    
    set(target, prop, value) {
      // Map v1.2 property changes back to canonical format  
      if (prop === 'input') {
        canonicalNodeDef.inputs = transformV1_2InputToLatest(value)
        notifyDataChange(canonicalNodeDef.name, prop, value)
        return true
      }
      canonicalNodeDef[mapV1_2PropToLatest(prop)] = value
      return true
    }
  })
}
```

## Implementation Architecture

### Phase 1: API Version Infrastructure

**1.1 Version-Specific Entry Points**
```typescript
// src/scripts/app/index.ts (latest/default)
export * from './latest'

// src/scripts/app/v1.ts  
export { app as default } from './adapters/v1AppAdapter'
export { extensionManager } from './adapters/v1ExtensionAdapter'
export { api } from './adapters/v1ApiAdapter'

// src/scripts/app/v1_2.ts
export { app as default } from './adapters/v1_2AppAdapter' 
export { extensionManager } from './adapters/v1_2ExtensionAdapter'
export { api } from './adapters/v1_2ApiAdapter'
```

**1.2 Version-Specific TypeScript Interfaces**
```typescript
// src/types/versions/v1.ts
export interface ComfyNodeDefV1 {
  name: string
  input?: {
    required?: Record<string, any>
    optional?: Record<string, any>
  }
  output?: string[]
  output_is_list?: boolean[]
}

// src/types/versions/v1_2.ts  
export interface ComfyNodeDefV1_2 extends ComfyNodeDefV1 {
  inputs?: ComfyInputSpecV1_2[]
  metadata?: NodeMetadataV1_2
}

// src/types/versions/v3.ts
export interface ComfyNodeDefV3 {
  name: string
  schema: JsonSchema
  inputs: InputSpecV3[]
  outputs: OutputSpecV3[]
}
```

### Phase 2: Multi-Version Data Layer

**2.1 Unified Data Store**
```typescript
// src/stores/nodeDefStore.ts
export const useNodeDefStore = defineStore('nodeDef', () => {
  const nodeDefinitions = ref<{
    canonical: Record<string, ComfyNodeDefLatest>
    v1: Record<string, ComfyNodeDefV1>
    v1_2: Record<string, ComfyNodeDefV1_2>
    v3: Record<string, ComfyNodeDefV3>
  }>({
    canonical: {},
    v1: {},
    v1_2: {},
    v3: {}
  })
  
  const fetchNodeDefinitions = async () => {
    const [currentData, v3Data] = await Promise.allSettled([
      api.get('/object_info'),
      api.get('/v3/object_info')
    ])
    
    nodeDefinitions.value = transformToAllVersions(currentData, v3Data)
  }
  
  // Version-specific getters with reactivity
  const getNodeDefsV1 = computed(() => nodeDefinitions.value.v1)
  const getNodeDefsV1_2 = computed(() => nodeDefinitions.value.v1_2)
  const getNodeDefsV3 = computed(() => nodeDefinitions.value.v3)
  
  return {
    nodeDefinitions,
    fetchNodeDefinitions,
    getNodeDefsV1,
    getNodeDefsV1_2, 
    getNodeDefsV3
  }
})
```

**2.2 Data Transformation Pipeline**
```typescript
// src/utils/versionTransforms.ts
export class VersionTransforms {
  static transformToAllVersions(currentData: any, v3Data: any) {
    const canonical = this.createCanonicalFormat(currentData, v3Data)
    
    return {
      canonical,
      v1: this.canonicalToV1(canonical),
      v1_2: this.canonicalToV1_2(canonical),
      v3: v3Data || this.canonicalToV3(canonical)
    }
  }
  
  static canonicalToV1(canonical: ComfyNodeDefLatest): ComfyNodeDefV1 {
    return {
      name: canonical.name,
      input: {
        required: canonical.inputs
          ?.filter(i => i.required)
          .reduce((acc, input) => {
            acc[input.name] = input.spec
            return acc
          }, {} as Record<string, any>),
        optional: canonical.inputs
          ?.filter(i => !i.required)
          .reduce((acc, input) => {
            acc[input.name] = input.spec
            return acc
          }, {} as Record<string, any>)
      },
      output: canonical.outputs?.map(o => o.type),
      output_is_list: canonical.outputs?.map(o => o.is_list)
    }
  }
  
  static canonicalToV1_2(canonical: ComfyNodeDefLatest): ComfyNodeDefV1_2 {
    return {
      ...this.canonicalToV1(canonical),
      inputs: canonical.inputs?.map(input => ({
        name: input.name,
        type: input.type,
        required: input.required,
        options: input.options
      }))
    }
  }
}
```

### Phase 3: Proxy-Based Synchronization

**3.1 Bidirectional Data Proxies**
```typescript
// src/utils/versionProxies.ts
export class VersionProxies {
  private static canonicalStore = new Map<string, ComfyNodeDefLatest>()
  private static eventBus = new EventTarget()
  
  static createV1Proxy(nodeId: string): ComfyNodeDefV1 {
    const canonical = this.canonicalStore.get(nodeId)
    if (!canonical) throw new Error(`Node ${nodeId} not found`)
    
    return new Proxy({} as ComfyNodeDefV1, {
      get(target, prop: keyof ComfyNodeDefV1) {
        return VersionProxies.transformCanonicalToV1Property(canonical, prop)
      },
      
      set(target, prop: keyof ComfyNodeDefV1, value) {
        VersionProxies.transformV1PropertyToCanonical(canonical, prop, value)
        VersionProxies.notifyChange(nodeId, prop, value)
        return true
      }
    })
  }
  
  static createV1_2Proxy(nodeId: string): ComfyNodeDefV1_2 {
    const canonical = this.canonicalStore.get(nodeId)
    if (!canonical) throw new Error(`Node ${nodeId} not found`)
    
    return new Proxy({} as ComfyNodeDefV1_2, {
      get(target, prop: keyof ComfyNodeDefV1_2) {
        return VersionProxies.transformCanonicalToV1_2Property(canonical, prop)
      },
      
      set(target, prop: keyof ComfyNodeDefV1_2, value) {
        VersionProxies.transformV1_2PropertyToCanonical(canonical, prop, value)
        VersionProxies.notifyChange(nodeId, prop, value)
        return true
      }
    })
  }
  
  private static transformCanonicalToV1Property(canonical: ComfyNodeDefLatest, prop: keyof ComfyNodeDefV1) {
    switch (prop) {
      case 'input':
        return {
          required: canonical.inputs?.filter(i => i.required).reduce((acc, input) => {
            acc[input.name] = input.spec
            return acc
          }, {} as Record<string, any>),
          optional: canonical.inputs?.filter(i => !i.required).reduce((acc, input) => {
            acc[input.name] = input.spec
            return acc
          }, {} as Record<string, any>)
        }
      case 'output':
        return canonical.outputs?.map(o => o.type)
      case 'output_is_list':
        return canonical.outputs?.map(o => o.is_list)
      default:
        return canonical[prop as keyof ComfyNodeDefLatest]
    }
  }
  
  private static transformV1PropertyToCanonical(canonical: ComfyNodeDefLatest, prop: keyof ComfyNodeDefV1, value: any) {
    switch (prop) {
      case 'input':
        canonical.inputs = [
          ...Object.entries(value.required || {}).map(([name, spec]) => ({
            name,
            spec,
            required: true,
            type: this.inferTypeFromSpec(spec)
          })),
          ...Object.entries(value.optional || {}).map(([name, spec]) => ({
            name,
            spec,
            required: false,
            type: this.inferTypeFromSpec(spec)
          }))
        ]
        break
      case 'output':
        canonical.outputs = value.map((type: string, index: number) => ({
          type,
          is_list: canonical.outputs?.[index]?.is_list || false
        }))
        break
      case 'output_is_list':
        canonical.outputs = canonical.outputs?.map((output, index) => ({
          ...output,
          is_list: value[index] || false
        }))
        break
      default:
        (canonical as any)[prop] = value
    }
  }
  
  private static notifyChange(nodeId: string, prop: string, value: any) {
    this.eventBus.dispatchEvent(new CustomEvent('nodedef-changed', {
      detail: { nodeId, prop, value }
    }))
  }
}
```

### Phase 4: Extension System Integration

**4.1 Version-Aware Extension Service**
```typescript
// src/services/extensionService.ts
export const useExtensionService = () => {
  const extensionsByVersion = new Map<string, ComfyExtension[]>()
  
  const registerExtension = (extension: ComfyExtension, apiVersion: string = 'latest') => {
    extension.apiVersion = apiVersion
    
    if (!extensionsByVersion.has(apiVersion)) {
      extensionsByVersion.set(apiVersion, [])
    }
    extensionsByVersion.get(apiVersion)!.push(extension)
  }
  
  const invokeExtensionsForAllVersions = async (hook: string, canonicalArgs: any[]) => {
    const promises = []
    
    for (const [version, extensions] of extensionsByVersion) {
      const versionPromise = invokeExtensionsForVersion(version, hook, canonicalArgs)
      promises.push(versionPromise)
    }
    
    await Promise.all(promises)
  }
  
  const invokeExtensionsForVersion = async (version: string, hook: string, canonicalArgs: any[]) => {
    const extensions = extensionsByVersion.get(version) || []
    
    for (const extension of extensions) {
      if (extension[hook]) {
        const transformedArgs = transformArgsForVersion(version, canonicalArgs)
        await extension[hook](...transformedArgs)
      }
    }
  }
  
  const transformArgsForVersion = (version: string, args: any[]) => {
    return args.map(arg => {
      if (arg && typeof arg === 'object' && arg.name) {
        // This is likely a node definition
        switch (version) {
          case 'v1':
            return VersionProxies.createV1Proxy(arg.name)
          case 'v1_2':
            return VersionProxies.createV1_2Proxy(arg.name)
          case 'v3':
            return VersionProxies.createV3Proxy(arg.name)
          default:
            return arg
        }
      }
      return arg
    })
  }
  
  return {
    registerExtension,
    invokeExtensionsForAllVersions,
    invokeExtensionsForVersion
  }
}
```

**4.2 Version-Specific App Adapters**
```typescript
// src/scripts/app/adapters/v1AppAdapter.ts
export class V1AppAdapter {
  constructor(private canonicalApp: ComfyApp) {}
  
  registerExtension(extension: ComfyExtensionV1) {
    const wrappedExtension = {
      ...extension,
      apiVersion: 'v1',
      beforeRegisterNodeDef: (nodeType, nodeData, app) => {
        const v1NodeData = VersionProxies.createV1Proxy(nodeData.name)
        return extension.beforeRegisterNodeDef?.(nodeType, v1NodeData, this)
      },
      nodeCreated: (node, app) => {
        return extension.nodeCreated?.(node, this)
      }
    }
    
    this.canonicalApp.registerExtension(wrappedExtension)
  }
  
  // Implement other ComfyApp methods with v1 compatibility
}

// src/scripts/app/adapters/v1_2AppAdapter.ts
export class V1_2AppAdapter {
  constructor(private canonicalApp: ComfyApp) {}
  
  registerExtension(extension: ComfyExtensionV1_2) {
    const wrappedExtension = {
      ...extension,
      apiVersion: 'v1_2',
      beforeRegisterNodeDef: (nodeType, nodeData, app) => {
        const v1_2NodeData = VersionProxies.createV1_2Proxy(nodeData.name)
        return extension.beforeRegisterNodeDef?.(nodeType, v1_2NodeData, this)
      }
    }
    
    this.canonicalApp.registerExtension(wrappedExtension)
  }
}
```

## Migration Strategy

### Gradual Migration Path

Extensions can migrate incrementally:

```typescript
// Phase 1: No changes (works with latest)
import { app } from '@/scripts/app'

// Phase 2: Explicit version (better compatibility)
import { app } from '@/scripts/app/v1_2'

// Phase 3: Use newer APIs when ready
import { app } from '@/scripts/app/latest'
```

### Development Tools

```typescript
// Enhanced debugging for version compatibility
ComfyUI.debugExtensions.showVersionMatrix() // Shows which extensions use which API versions
ComfyUI.debugExtensions.testVersionCompatibility() // Tests extension against all API versions
ComfyUI.debugExtensions.validateDataSync() // Validates proxy synchronization
```

## Benefits

1. **Type Safety**: Compile-time type checking for each API version
2. **Zero Breaking Changes**: Existing extensions work unchanged
3. **Bidirectional Sync**: Changes through any API version stay synchronized
4. **Future Proof**: Easy to add new API versions
5. **Performance**: No runtime version detection overhead
6. **Developer Experience**: Clear, typed interfaces for each version

## Implementation Timeline

- **Phase 1**: API Version Infrastructure (3-4 days)
- **Phase 2**: Multi-Version Data Layer (2-3 days)
- **Phase 3**: Proxy-Based Synchronization (2-3 days)
- **Phase 4**: Extension System Integration (2-3 days)
- **Phase 5**: Migration Tools & Documentation (1-2 days)

**Total Estimated Time**: 10-15 days

This approach provides a solid foundation for API versioning that scales with ComfyUI's growth while maintaining backward compatibility and providing a smooth migration path for extension developers.
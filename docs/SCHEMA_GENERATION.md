# ComfyUI Workflow Schema Generation

This document describes the process for generating and maintaining JSON Schema definitions for ComfyUI workflows.

## Overview

ComfyUI uses **Zod schemas** in TypeScript to define workflow structure, which are converted to **JSON Schema** format for external consumption, documentation, and validation.

### Schema Versions

- **Version 0.4** (Legacy): Original workflow format with array-based links
- **Version 1.0** (Current): Modern format with object-based links, subgraphs, and reroutes

## Schema Generation Process

### Prerequisites

1. Ensure all dependencies are installed: `npm install`
2. Verify TypeScript compilation: `npm run typecheck`

### Command

```bash
npm run json-schema
```

This runs the generation script: `scripts/generate-json-schema.ts`

### Output

Generated schemas are written to `./schemas/` directory:

- `workflow-0_4.json` (~80KB) - Legacy workflow format
- `workflow-1_0.json` (~82KB) - Current workflow format
- `node-def-v1.json` - Node definition schema v1
- `node-def-v2.json` - Node definition schema v2

**Note**: The `./schemas/` directory is gitignored and not committed to the repository.

## When to Regenerate Schemas

### Required Regeneration

Run schema generation when:

1. **Schema Changes**: Any modifications to files in `/src/schemas/`
2. **Breaking Changes**: Changes that affect data structure or validation
3. **New Features**: Adding new workflow capabilities (subgraphs, reroutes, etc.)
4. **Documentation Updates**: When schema descriptions change

### Schema Version Bumping

Only increment schema version for **breaking changes**:

- Data structure changes (field renames, type changes)
- Required field additions
- Format changes that break backward compatibility

**Non-breaking changes** (documentation, optional fields) should NOT bump the version.

## Schema Sources

### Primary Schemas (Zod-based)

#### Workflow Schemas
- **File**: `src/schemas/comfyWorkflowSchema.ts`
- **Exports**: `zComfyWorkflow` (v0.4), `zComfyWorkflow1` (v1.0)
- **Purpose**: Defines workflow JSON structure for both legacy and modern formats

#### Node Definition Schemas
- **Files**: 
  - `src/schemas/nodeDefSchema.ts` (v1)
  - `src/schemas/nodeDef/nodeDefSchemaV2.ts` (v2)
- **Purpose**: Defines node definition structure for different versions

### Generation Configuration

The generation script uses:
- **Library**: `zod-to-json-schema`
- **Strategy**: `$refStrategy: 'none'` (inlines all references)
- **Output**: Formatted JSON with proper naming

## Standard Operating Procedure (SOP)

### For Schema Updates

1. **Make Changes**: Modify Zod schemas in `/src/schemas/`
2. **Test Locally**: Ensure changes work with existing workflows
3. **Run Generation**: `npm run json-schema`
4. **Validate Output**: Check generated schemas for correctness
5. **Test Integration**: Verify schemas work with external tools
6. **Document Changes**: Update this document if process changes

### For Version Bumps

1. **Assess Breaking Changes**: Determine if changes are truly breaking
2. **Update Version**: Increment version number in schema definition
3. **Update Validation**: Modify `validateComfyWorkflow()` function
4. **Update Serialization**: Update LGraph serialization if needed
5. **Test Backward Compatibility**: Ensure old workflows still load
6. **Document Migration**: Provide migration guide if needed

### For External Publishing

**Current Status**: No automated publishing to docs.comfy.org exists yet.

**Recommended Process**:
1. Generate schemas locally
2. Copy to appropriate documentation repository
3. Update documentation with new schema versions
4. Coordinate with docs team for publication

## Troubleshooting

### Common Issues

#### Lodash Import Errors
**Error**: `SyntaxError: The requested module 'lodash' does not provide an export named 'clamp'`

**Solution**: Use the simplified generation script that avoids litegraph imports:
```bash
npx tsx scripts/generate-json-schema-simple.ts
```

#### Recursive Reference Warnings
**Warning**: `Recursive reference detected... Defaulting to any`

**Explanation**: This is expected for subgraph definitions and doesn't affect functionality.

### Schema Validation Issues

1. **Check Source Schema**: Verify Zod schema is valid
2. **Test TypeScript**: Run `npm run typecheck`
3. **Check Dependencies**: Ensure all imports resolve correctly
4. **Validate Output**: Test generated JSON Schema with online validators

## Integration Points

### External Documentation
- **docs.comfy.org**: Official ComfyUI documentation site
- **Workflow Spec**: https://docs.comfy.org/specs/workflow_json

### Development Tools
- **IDE Support**: Generated schemas provide autocomplete and validation
- **API Validation**: External tools can validate workflow JSON
- **Documentation Generation**: Schemas document workflow structure

## Future Improvements

1. **Automated Publishing**: Set up CI/CD to publish schemas to docs.comfy.org
2. **Version Management**: Implement semantic versioning for schema changes
3. **Migration Tools**: Create utilities to migrate between schema versions
4. **Testing**: Add automated tests for schema generation and validation
5. **Documentation**: Generate human-readable documentation from schemas

## References

- **Zod Documentation**: https://zod.dev/
- **JSON Schema Specification**: https://json-schema.org/
- **ComfyUI Workflow Specification**: https://docs.comfy.org/specs/workflow_json
import type { NodeOf, Rule } from './astTypes'

type FunctionNode = NodeOf<
  'ArrowFunctionExpression' | 'FunctionDeclaration' | 'FunctionExpression'
>
type Parameter = FunctionNode['params'][number]
type IdentifierParameter = Extract<Parameter, { type: 'Identifier' }>
type TypeNode = NonNullable<
  IdentifierParameter['typeAnnotation']
>['typeAnnotation']

const NULLISH_TYPES = new Set(['TSNullKeyword', 'TSUndefinedKeyword'])

function isBooleanMember(type: TypeNode): boolean {
  if (type.type === 'TSBooleanKeyword') return true
  return (
    type.type === 'TSLiteralType' &&
    type.literal.type === 'Literal' &&
    typeof type.literal.value === 'boolean'
  )
}

function isBooleanType(type: TypeNode | undefined): boolean {
  if (!type) return false
  if (isBooleanMember(type)) return true
  if (type.type !== 'TSUnionType') return false
  const meaningful = type.types.filter(
    (member) => !NULLISH_TYPES.has(member.type)
  )
  return meaningful.length > 0 && meaningful.every(isBooleanMember)
}

function isBooleanParameter(parameter: Parameter): boolean {
  if (parameter.type === 'Identifier') {
    return isBooleanType(parameter.typeAnnotation?.typeAnnotation)
  }
  if (parameter.type !== 'AssignmentPattern') return false
  const { left, right } = parameter
  const annotation =
    left.type === 'Identifier' ? left.typeAnnotation?.typeAnnotation : undefined
  if (annotation) return isBooleanType(annotation)
  return right.type === 'Literal' && typeof right.value === 'boolean'
}

function isThisParameter(parameter: Parameter): boolean {
  return parameter.type === 'Identifier' && parameter.name === 'this'
}

function isExportedFunction(fn: FunctionNode): boolean {
  const { parent } = fn
  if (parent.type === 'ExportDefaultDeclaration') return true
  if (fn.type === 'FunctionDeclaration') {
    return parent.type === 'ExportNamedDeclaration'
  }
  return (
    parent.type === 'VariableDeclarator' &&
    parent.parent.type === 'VariableDeclaration' &&
    parent.parent.parent.type === 'ExportNamedDeclaration'
  )
}

function isPublicMethod(fn: FunctionNode): boolean {
  const { parent } = fn
  return (
    parent.type === 'MethodDefinition' &&
    parent.kind === 'method' &&
    parent.key.type !== 'PrivateIdentifier' &&
    parent.accessibility !== 'private' &&
    parent.accessibility !== 'protected'
  )
}

export const noPositionalBooleanParams: Rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Pass flags to exported functions and public methods through an options object'
    },
    schema: [],
    messages: {
      positionalBoolean:
        'A positional boolean makes call sites like fn(x, true) unreadable. Take an options object with a named flag instead.'
    }
  },
  create(context) {
    function check(fn: FunctionNode) {
      if (!fn.body || (!isExportedFunction(fn) && !isPublicMethod(fn))) return
      const parameters = fn.params.filter(
        (parameter) => !isThisParameter(parameter)
      )
      if (parameters.length < 2) return
      for (const parameter of parameters) {
        if (isBooleanParameter(parameter)) {
          context.report({ node: parameter, messageId: 'positionalBoolean' })
        }
      }
    }
    return {
      ArrowFunctionExpression: check,
      FunctionDeclaration: check,
      FunctionExpression: check
    }
  }
}

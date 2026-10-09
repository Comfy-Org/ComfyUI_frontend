import type { ESLint, Rule } from 'eslint'

const noJsPrivateClassMembers: Rule.RuleModule = {
  meta: { schema: [], type: 'problem' },
  create(context) {
    return {
      PrivateIdentifier(node) {
        const parent = context.sourceCode.getAncestors(node).at(-1)
        if (
          parent?.type === 'PropertyDefinition' ||
          parent?.type === 'MethodDefinition'
        ) {
          context.report({
            node,
            message:
              'Do not use JavaScript hard-private class members. Use TypeScript private members instead.'
          })
        }
      }
    }
  }
}

export default {
  meta: { name: '@comfyorg/code-quality' },
  rules: { 'no-js-private-class-members': noJsPrivateClassMembers }
} satisfies ESLint.Plugin

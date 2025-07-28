import eslint from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import eslintPluginAntfu from "eslint-plugin-antfu"
import jsdoc from "eslint-plugin-jsdoc"
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort"
import eslintPluginUnicorn from "eslint-plugin-unicorn"
import unusedImports from "eslint-plugin-unused-imports"
import globals from "globals"
import tseslint from "typescript-eslint"

const rules = Object.fromEntries(
  Object.entries(eslintPluginAntfu.rules).map(([id]) => [`antfu/${id}`, "off"]),
)
const antfuLint = {
  name: "antfu/without-if-newline-or-imports",
  plugins: { antfu: eslintPluginAntfu },
  rules,
}

const unicornRecommended = eslintPluginUnicorn.configs.recommended

export default tseslint.config(
  { ignores: [".*/**", "dist/**", "scripts/**"] },
  { files: ["**/*.{js,mjs,ts,mts}"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  stylistic.configs.customize({
    quotes: "double",
    braceStyle: "1tbs",
    commaDangle: "always-multiline",
  }),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.js",
            "lint-staged.config.js",
            "vite.config.mts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      jsdoc: {
        mode: "typescript",
      },
    },
  },
  {
    ignores: ["./dist/**/*"],
  },

  // Unicorn
  unicornRecommended,
  {
    rules: {
      // Temporarily disabled
      // See https://github.com/Comfy-Org/litegraph.js/issues/629
      "unicorn/no-lonely-if": "off",
      "unicorn/no-this-assignment": "off",
      "unicorn/no-useless-switch-case": "off",
      "unicorn/no-zero-fractions": "off",
      "unicorn/prefer-blob-reading-methods": "off",
      "unicorn/prefer-default-parameters": "off",
      "unicorn/prefer-math-min-max": "off",
      "unicorn/prefer-query-selector": "off",
      "unicorn/prefer-spread": "off",
      "unicorn/prefer-structured-clone": "off",
      "unicorn/prefer-switch": "off",
      "unicorn/prefer-ternary": "off",

      // Disable rules
      "unicorn/consistent-function-scoping": "off",
      "unicorn/explicit-length-check": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-null": "off",
      "unicorn/prefer-global-this": "off",
      "unicorn/prefer-number-properties": "off",
      "unicorn/prefer-string-raw": "off",
      "unicorn/prefer-string-slice": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/require-number-to-fixed-digits-argument": "off",
      "unicorn/switch-case-braces": "off",

      // Node rules: dev dependency config, etc.
      "unicorn/prefer-module": "error",
      "unicorn/prefer-node-protocol": "error",
    },
  },

  // JSDoc
  jsdoc.configs["flat/contents-typescript-error"],
  jsdoc.configs["flat/logical-typescript-error"],
  jsdoc.configs["flat/stylistic-typescript-error"],
  {
    rules: {
      "jsdoc/check-param-names": [
        "error",
        {
          disableMissingParamChecks: true,
          disableExtraPropertyReporting: true,
          checkRestProperty: false,
          checkDestructured: false,
        },
      ],
      "jsdoc/check-tag-names": ["error", { definedTags: ["remarks"] }],
      "jsdoc/multiline-blocks": "error",
      // Disabling
      "jsdoc/empty-tags": "off",
      "jsdoc/lines-before-block": "off",
      "jsdoc/match-description": "off",
      "jsdoc/no-undefined-types": "off",
      "jsdoc/text-escaping": "off",
      "jsdoc/valid-types": "off",
      "jsdoc/informative-docs": "off",
    },
  },

  // Base, TypeScript, and Stylistic
  {
    rules: {
      "prefer-template": "error",

      // TODO: Update when TypeScript has been cleaned
      // https://github.com/Comfy-Org/litegraph.js/issues/657
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "prefer-spread": "off",
      "no-empty": "off",
      "no-prototype-builtins": "off",
      "no-var": "error",
      "no-fallthrough": "off",

      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],

      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-this-alias": "off",

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",

      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-for-in-array": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/no-duplicate-type-constituents": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      // "@typescript-eslint/prefer-readonly-parameter-types": "error",
      // "@typescript-eslint/no-unsafe-function-type": "off",

      "@stylistic/max-len": [
        "off",
        {
          code: 100,
          comments: 130,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
        },
      ],

      // "@stylistic/multiline-comment-style": ["error", "starred-block"],
      "@stylistic/curly-newline": [
        "error",
        { consistent: true, multiline: true },
      ],
      // "@stylistic/object-property-newline": ["error", { allowAllPropertiesOnSameLine: true }],
      // "@stylistic/object-property-newline": "error",
      "@stylistic/one-var-declaration-per-line": "error",

      "@stylistic/array-bracket-newline": ["error", { multiline: true }],
      "@stylistic/array-element-newline": [
        "error",
        { consistent: true, multiline: true },
      ],

      "@stylistic/function-paren-newline": ["error", "multiline-arguments"],

      "@stylistic/array-bracket-spacing": "error",
      "@stylistic/arrow-parens": "error",
      "@stylistic/arrow-spacing": "error",
      "@stylistic/block-spacing": "error",
      "@stylistic/brace-style": "error",
      "@stylistic/comma-dangle": "error",
      "@stylistic/comma-spacing": "error",
      "@stylistic/comma-style": "error",
      "@stylistic/computed-property-spacing": "error",
      "@stylistic/dot-location": "error",
      "@stylistic/eol-last": "error",
      "@stylistic/indent": ["error", 2, { VariableDeclarator: "first" }],
      "@stylistic/indent-binary-ops": "error",
      "@stylistic/key-spacing": "error",
      "@stylistic/keyword-spacing": "error",
      "@stylistic/lines-between-class-members": "error",
      "@stylistic/max-statements-per-line": "error",
      "@stylistic/member-delimiter-style": "error",
      "@stylistic/multiline-ternary": "error",
      "@stylistic/new-parens": "error",
      "@stylistic/no-extra-parens": "error",
      "@stylistic/no-floating-decimal": "error",
      "@stylistic/no-mixed-operators": "error",
      "@stylistic/no-mixed-spaces-and-tabs": "error",
      "@stylistic/no-multi-spaces": "error",
      "@stylistic/no-multiple-empty-lines": "error",
      "@stylistic/no-tabs": "error",
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/no-whitespace-before-property": "error",
      "@stylistic/object-curly-spacing": "error",
      "@stylistic/operator-linebreak": [
        "error",
        "after",
        { overrides: { "?": "before", ":": "before" } },
      ],
      "@stylistic/padded-blocks": "error",
      "@stylistic/quote-props": "error",
      "@stylistic/quotes": "error",
      "@stylistic/rest-spread-spacing": "error",
      "@stylistic/semi": "error",
      "@stylistic/semi-spacing": "error",
      "@stylistic/semi-style": ["error", "first"],
      "@stylistic/space-before-blocks": "error",
      "@stylistic/space-before-function-paren": "error",
      "@stylistic/space-in-parens": "error",
      "@stylistic/space-infix-ops": "error",
      "@stylistic/space-unary-ops": "error",
      "@stylistic/spaced-comment": "error",
      "@stylistic/template-curly-spacing": "error",
      "@stylistic/template-tag-spacing": "error",
      "@stylistic/type-annotation-spacing": "error",
      "@stylistic/type-generic-spacing": "error",
      "@stylistic/type-named-tuple-spacing": "error",
      "@stylistic/wrap-iife": "error",
      "@stylistic/yield-star-spacing": "error",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
    },
    files: ["test/**/*.ts"],
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Antfu
  antfuLint,
  {
    rules: {
      "antfu/consistent-chaining": "error",
      "antfu/consistent-list-newline": "error",
      "antfu/curly": "error",
      "antfu/import-dedupe": "error",
      "antfu/no-import-dist": "error",
      "antfu/no-ts-export-equal": "error",
      "antfu/top-level-function": "error",
    },
  },

  // Sort imports
  {
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          // The default grouping, but with type imports first as a separate group.
          groups: [
            ["^.*\\u0000$"],
            ["^\\u0000"],
            ["^node:"],
            ["^@?\\w"],
            ["^"],
            ["^\\."],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
    },
  },
)

import globals from "globals"
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import stylistic from "@stylistic/eslint-plugin"
import unusedImports from "eslint-plugin-unused-imports"

export default tseslint.config(
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
  },
  {
    ignores: ["./dist/**/*"],
  },
  {
    rules: {
      // TODO: Update when TypeScript has been cleaned
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
      "@stylistic/object-curly-newline": [
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
      "@stylistic/newline-per-chained-call": "error",

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
      "unused-imports/no-unused-vars": "error",
    },
  },
)

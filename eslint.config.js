import globals from "globals"
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import stylistic from "@stylistic/eslint-plugin"

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
      "no-var": "warn",
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
      "@typescript-eslint/no-unused-vars": "off",
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

      // "@stylistic/multiline-comment-style": ["warn", "starred-block"],
      "@stylistic/curly-newline": [
        "warn",
        { consistent: true, multiline: true },
      ],
      "@stylistic/object-curly-newline": [
        "warn",
        { consistent: true, multiline: true },
      ],
      // "@stylistic/object-property-newline": ["warn", { allowAllPropertiesOnSameLine: true }],
      // "@stylistic/object-property-newline": "warn",
      "@stylistic/one-var-declaration-per-line": "warn",

      "@stylistic/array-bracket-newline": ["warn", { multiline: true }],
      "@stylistic/array-element-newline": [
        "warn",
        { consistent: true, multiline: true },
      ],

      "@stylistic/function-paren-newline": ["warn", "multiline-arguments"],
      "@stylistic/newline-per-chained-call": "warn",

      "@stylistic/array-bracket-spacing": "warn",
      "@stylistic/arrow-parens": "warn",
      "@stylistic/arrow-spacing": "warn",
      "@stylistic/block-spacing": "warn",
      "@stylistic/brace-style": "warn",
      "@stylistic/comma-dangle": "warn",
      "@stylistic/comma-spacing": "warn",
      "@stylistic/comma-style": "warn",
      "@stylistic/computed-property-spacing": "warn",
      "@stylistic/dot-location": "warn",
      "@stylistic/eol-last": "warn",
      "@stylistic/indent": ["warn", 2, { VariableDeclarator: "first" }],
      "@stylistic/indent-binary-ops": "warn",
      "@stylistic/key-spacing": "warn",
      "@stylistic/keyword-spacing": "warn",
      "@stylistic/lines-between-class-members": "warn",
      "@stylistic/max-statements-per-line": "warn",
      "@stylistic/member-delimiter-style": "warn",
      "@stylistic/multiline-ternary": "warn",
      "@stylistic/new-parens": "warn",
      "@stylistic/no-extra-parens": "warn",
      "@stylistic/no-floating-decimal": "warn",
      "@stylistic/no-mixed-operators": "warn",
      "@stylistic/no-mixed-spaces-and-tabs": "warn",
      "@stylistic/no-multi-spaces": "warn",
      "@stylistic/no-multiple-empty-lines": "warn",
      "@stylistic/no-tabs": "warn",
      "@stylistic/no-trailing-spaces": "warn",
      "@stylistic/no-whitespace-before-property": "warn",
      "@stylistic/object-curly-spacing": "warn",
      "@stylistic/operator-linebreak": [
        "warn",
        "after",
        { overrides: { "?": "before", ":": "before" } },
      ],
      "@stylistic/padded-blocks": "warn",
      "@stylistic/quote-props": "warn",
      "@stylistic/quotes": "warn",
      "@stylistic/rest-spread-spacing": "warn",
      "@stylistic/semi": "warn",
      "@stylistic/semi-spacing": "warn",
      "@stylistic/semi-style": ["warn", "first"],
      "@stylistic/space-before-blocks": "warn",
      "@stylistic/space-before-function-paren": "warn",
      "@stylistic/space-in-parens": "warn",
      "@stylistic/space-infix-ops": "warn",
      "@stylistic/space-unary-ops": "warn",
      "@stylistic/spaced-comment": "warn",
      "@stylistic/template-curly-spacing": "warn",
      "@stylistic/template-tag-spacing": "warn",
      "@stylistic/type-annotation-spacing": "warn",
      "@stylistic/type-generic-spacing": "warn",
      "@stylistic/type-named-tuple-spacing": "warn",
      "@stylistic/wrap-iife": "warn",
      "@stylistic/yield-star-spacing": "warn",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
    },
    files: ["test/**/*.ts"],
  },
)

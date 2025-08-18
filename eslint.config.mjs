import globals from "globals";
import js from "@eslint/js";

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        process: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      indent: ["error", 4, { SwitchCase: 1 }],
      semi: ["error", "always"],
      quotes: ["error", "single", { avoidEscape: true }],
      "object-curly-spacing": ["error", "always"],
      "arrow-parens": ["error", "always"],
      "comma-dangle": [
        "error",
        {
          arrays: "always",
          objects: "always",
          imports: "always",
          exports: "always",
          functions: "never",
        },
      ],

      "comma-spacing": ["error", { before: false, after: true }],
      "space-before-blocks": ["error", "always"],
      "keyword-spacing": ["error", { before: true, after: true }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 1 }],
      "eol-last": ["error", "always"],
      "no-trailing-spaces": "error",
      "brace-style": ["error", "1tbs", { allowSingleLine: true }],
      "func-call-spacing": ["error", "never"],
      "space-in-parens": ["error", "never"],
      "array-bracket-spacing": ["error", "never"],
    },
  },
  js.configs.recommended,
  {
    ignores: ["node_modules/", "client/"],
  },
];

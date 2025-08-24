import globals from "globals";
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: ["node_modules/", "dist/", "build/"],
  },

  {
    files: ["server/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        process: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
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

  {
    files: ["client/**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true }, 
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...js.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", 
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "error",
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "React" }, // <-- silences unused React
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  }
];

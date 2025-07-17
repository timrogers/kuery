const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");

const {
    fixupPluginRules,
    fixupConfigRules,
} = require("@eslint/compat");

const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",

        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },

        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.webextensions,
        },
    },

    plugins: {
        "@typescript-eslint": typescriptEslint,
        react,
        "react-hooks": fixupPluginRules(reactHooks),
    },

    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "prettier",
    )),

    settings: {
        react: {
            version: "detect",
        },
    },

    rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
        }],

        "@typescript-eslint/no-explicit-any": "warn",
        "no-console": "off",
        "react/no-unescaped-entities": "off",
        "no-case-declarations": "off",
    },
}, globalIgnores([
    "**/build/",
    "**/dist/",
    "**/.plasmo/",
    "**/node_modules/",
    "**/*.min.js",
    "assets/sql-wasm.js",
    "assets/inject.js",
])]);

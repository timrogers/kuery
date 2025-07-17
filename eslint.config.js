import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
        ...reactPlugin.configs.flat.recommended,
        ...reactPlugin.configs.flat['jsx-runtime'],
        ...reactHooks.configs['recommended-latest'],
    },
    {
        files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
        languageOptions: {
            globals: {
                ...globals.serviceworker,
                ...globals.browser,
            },
        },
    },
    {
        ignores: [
          'build/',
          'dist/',
          '.plasmo/',
          'node_modules/',
          '*.min.js',
          'assets/sql-wasm.js',
          'assets/inject.js',
        ]
    }
);
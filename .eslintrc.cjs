module.exports = {
    env: {
        browser: true,
        es2022: true,
    },
    extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
    ],
    settings: {
        "import/resolver": {
            typescript: true,
            node: true,
        },
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "@typescript-eslint/consistent-type-imports": "warn",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        "prettier/prettier": [
            "warn",
            {
                endOfLine: "auto",
            },
        ],
        "prefer-const": "warn",
        "import/order": [
            "warn",
            {
                alphabetize: {
                    order: "asc",
                    orderImportKind: "asc",
                    caseInsensitive: true,
                },
            },
        ],
        "import/no-unresolved": "off",
        "@typescript-eslint/no-unused-expressions": [
            "warn",
            {
                allowTaggedTemplates: true,
            },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
    },

    ignorePatterns: ["node_modules/*", "dist/*", ".lintstagedrc"],
}

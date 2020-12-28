module.exports = {
    parserOptions: {
        ecmaVersion: 2019
    },
    plugins: ["import", "mocha"],
    extends: ["standard", "prettier", "prettier/standard"],
    rules: {
        "import/no-unresolved": ["error", { commonjs: true }],
        "prefer-template": "error",
        "prefer-const": "error"
    },
    overrides: [
        {
            files: ["examples/*.js"],
            rules: {
                "import/no-unresolved": "off"
            }
        },
        {
            env: {
                mocha: true
            },
            files: ["*.spec.js"],
            rules: {
                "no-new": "off",
                "mocha/no-exclusive-tests": "error",
                "mocha/no-nested-tests": "error",
                "mocha/no-identical-title": "error"
            }
        }
    ]
};

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    indent: ['error', 2, { MemberExpression: 0 }],
    'no-trailing-spaces': 'error',
    'object-curly-newline': ['error', {
      ObjectExpression: { minProperties: 7, multiline: true, consistent: true },
      ObjectPattern: { minProperties: 7, multiline: true, consistent: true },
    }],
    'arrow-parens': 'off',
    'no-return-assign': 'off',
    'no-plusplus': 'off',
    'no-confusing-arrow': 'off',
    'class-methods-use-this': 'off',
    'import/no-unresolved': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'lines-between-class-members': 'off',
    'no-param-reassign': 'off',
  },
};

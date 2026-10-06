export default [{
  files: ['public/assets/*.js'],
  languageOptions: {
    ecmaVersion: 'latest', sourceType: 'module',
    globals: Object.fromEntries(['document','window','location','fetch','URL','URLSearchParams','FormData','setTimeout'].map(name=>[name,'readonly']))
  },
  rules: { 'no-undef': 'error', 'no-unused-vars': 'error', 'eqeqeq': 'error' }
}];

module.exports = {
  env: { 
    NODE_ENV: '"development"',
    AIBOOK_API_BASE: JSON.stringify(process.env.AIBOOK_API_BASE || 'http://localhost:3000')
  },
  defineConstants: {},
  mini: {},
  h5: {}
}

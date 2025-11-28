import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = createRoot(document.getElementById('app'))

const render = Component => {
  root.render(
    <Component />,
  )
}

render(App)

// Webpack Hot Module Replacement API
if (module.hot) {
  module.hot.accept('./App', () => {
    const NextApp = require('./App').default
    render(NextApp)
  })
}

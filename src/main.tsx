import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ConfigError } from './app/ConfigError'
import { missingSettings } from './config/env'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found in index.html.')
}

createRoot(rootElement).render(
  <StrictMode>{missingSettings.length > 0 ? <ConfigError missing={missingSettings} /> : <App />}</StrictMode>,
)

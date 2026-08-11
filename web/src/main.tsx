import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes.css'
import './brainless.css'
import App from './App.tsx'
import { watchSlowBoot } from './boot'

// Sunucu geç kalırsa perdedeki durum metni sebebini söylesin.
watchSlowBoot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

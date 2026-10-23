import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p/400.css'
import './styles.css'
import { App } from './App'

if (navigator.userAgent.includes('Macintosh')) document.body.classList.add('mac')

createRoot(document.getElementById('root')!).render(<App />)

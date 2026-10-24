import '@fontsource-variable/inter'
import './styles/app.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(<App />)

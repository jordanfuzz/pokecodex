import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router'
import App from './app'

const root = createRoot(document.getElementById('app'))
root.render(
  <Router>
    <App />
  </Router>
)

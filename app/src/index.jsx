import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon'
import App from './app'

const root = createRoot(document.getElementById('app'))
root.render(
  <Router>
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <App />
    </LocalizationProvider>
  </Router>
)

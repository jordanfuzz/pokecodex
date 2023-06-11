import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon'
import App from './app'

ReactDOM.render(
  <Router>
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <App />
    </LocalizationProvider>
  </Router>,
  document.getElementById('app')
)

import React from 'react'
import { Switch, Route } from 'react-router-dom'
import Home from './components/home/home'
import './app.scss'

const App = () => {
  return (
    <div className="background">
      <Switch>
        <Route exact path="/" component={Home} />
      </Switch>
    </div>
  )
}

export default App

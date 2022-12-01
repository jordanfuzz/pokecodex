import React from 'react'
import { Switch, Route } from 'react-router-dom'
import Home from './components/home/home'
import Sources from './components/sources/sources'
import './app.scss'

const App = () => {
  return (
    <div className="background">
      <Switch>
        <Route exact path="/" component={Home} />
        <Route exact path="/sources" component={Sources} />
      </Switch>
    </div>
  )
}

export default App

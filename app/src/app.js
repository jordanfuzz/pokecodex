import React from 'react'
import Modal from 'react-modal'
import { Switch, Route } from 'react-router-dom'
import Home from './components/home/home'
import BoxView from './components/box-view/box-view'
import Login from './components/login/login'
import Sources from './components/sources/sources'
import './app.scss'

Modal.setAppElement('#app')

const App = () => {
  return (
    <div className="background">
      <Switch>
        <Route exact path="/" component={Home} />
        <Route exact path="/box-view" component={BoxView} />
        <Route exact path="/login" component={Login} />
        <Route exact path="/sources" component={Sources} />
      </Switch>
    </div>
  )
}

export default App

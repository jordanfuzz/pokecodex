import React, { Component } from 'react';
import './App.css';
import Nav from './components/Nav/Nav'
import router from './router'

class App extends Component {
  render() {
    return (
      <div className="App">
        <Nav />
        {router}
      </div>
    );
  }
}

export default App;

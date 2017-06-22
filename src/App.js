import React, { Component } from 'react';
import './App.css';
import PokemonFinder from './components/PokemonFinder/PokemonFinder'
import Nav from './components/Nav/Nav'

class App extends Component {
  render() {
    return (
      <div className="App">
        <Nav />
        <PokemonFinder />
      </div>
    );
  }
}

export default App;

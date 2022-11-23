import React from 'react'
import {Switch, Route} from 'react-router-dom'
import PokemonFinder from './components/PokemonFinder/PokemonFinder'
import PokemonPicker from './components/PokemonPicker/PokemonPicker'
import PokemonTeam from './components/PokemonTeam/PokemonTeam'



export default (
  <Switch>
    <Route exact path="/" component={PokemonFinder} />
    <Route path="/picker" component={PokemonPicker} />
    <Route path="/team" component={PokemonTeam} />
  </Switch>
)
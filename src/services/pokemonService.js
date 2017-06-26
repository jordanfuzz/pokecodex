import axios from 'axios'
import {getPokemon, addToTeam} from '../ducks/reducer'
import store from '../store'

export default function dispatchGetPokemon(name) {
  console.log("dispatched", name)
  let promise = axios.get(`http://pokeapi.co/api/v2/pokemon/${name}/`).then(response => response.data)
  store.dispatch(getPokemon(promise))
}

export function dispatchAddToTeam(name, index) {
  console.log('dispatchAddToTeam')
  let promise = axios.get(`http://pokeapi.co/api/v2/pokemon/${name}/`).then(response => response.data)
  store.dispatch(addToTeam(promise, index))
}
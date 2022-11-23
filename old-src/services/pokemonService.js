import axios from 'axios'
import {getPokemon, addToTeam, addType} from '../ducks/reducer'
import store from '../store'

export default function dispatchGetPokemon(name) {
  let promise = axios.get(`http://pokeapi.co/api/v2/pokemon/${name}/`).then(response => response.data)
  store.dispatch(getPokemon(promise))
}

export function dispatchAddToTeam(name) {
  let promise = axios.get(`http://pokeapi.co/api/v2/pokemon/${name}/`).then(response => response.data)
  store.dispatch(addToTeam(promise))
}

export function dispatchAddType(type) {
  let promise = axios.get(`http://pokeapi.co/api/v2/type/${type}/`).then(response => response.data)
  store.dispatch(addType(promise))
}
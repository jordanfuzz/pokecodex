import axios from 'axios'
import {getPokemon} from '../ducks/reducer'
import store from '../store'

export default function dispatchGetPokemon(name) {
  console.log("dispatched", name)
  let promise = axios.get(`http://pokeapi.co/api/v2/pokemon/${name}/`).then(response => response.data)
  store.dispatch(getPokemon(promise))
}
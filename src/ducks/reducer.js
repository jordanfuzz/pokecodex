let initialState = {
  pokemon: {}
}

const GET_POKEMON = "GET_POKEMON"

//reducer
export default function reducer(state = initialState, action) {
  switch(action.type) {
    case GET_POKEMON + '_PENDING':
      console.log("promise pending")
      return state
    case GET_POKEMON + '_FULFILLED':
      return Object.assign({}, state, {pokemon: action.payload})
    default:
      return state
  }
}


export function getPokemon(promise) {
  return {
    type: GET_POKEMON,
    payload: promise
  }
}
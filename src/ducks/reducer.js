let initialState = {
  pokemon: {},
  userTeam: [],
  types: [],
  resultsReady: false
}

const GET_POKEMON = "GET_POKEMON"
const ADD_TO_TEAM = "ADD_TO_TEAM"
const ADD_TYPE = "ADD_TYPE"

//reducer
export default function reducer(state = initialState, action) {
  switch(action.type) {
    case GET_POKEMON + '_PENDING':
      return state
    case GET_POKEMON + '_FULFILLED':
      return Object.assign({}, state, {pokemon: action.payload, types: [], resultsReady: false})
    case ADD_TO_TEAM + '_PENDING':
      return state
    case ADD_TO_TEAM + '_FULFILLED':
      let newTeam = state.userTeam.slice(0)
      newTeam.push(action.payload)
      return Object.assign({}, state, {userTeam: newTeam})
    case ADD_TYPE + '_PENDING':
      return state;
    case ADD_TYPE + '_FULFILLED':
      let newTypes = state.types.slice(0)
      newTypes.push(action.payload)
      return Object.assign({}, state, {types: newTypes, resultsReady: true})
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

export function addToTeam(promise) {
  return {
    type: ADD_TO_TEAM,
    payload: promise
  }
}

export function addType(promise) {
  return {
    type: ADD_TYPE,
    payload: promise
  }
}
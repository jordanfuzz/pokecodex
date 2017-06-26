let initialState = {
  pokemon: {},
  userTeam: [{},{},{},{},{},{}]
}

const GET_POKEMON = "GET_POKEMON"
const ADD_TO_TEAM = "ADD_TO_TEAM"

//reducer
export default function reducer(state = initialState, action) {
  console.log(action.type)
  switch(action.type) {
    case GET_POKEMON + '_PENDING':
      console.log("promise pending")
      return state
    case GET_POKEMON + '_FULFILLED':
      return Object.assign({}, state, {pokemon: action.payload})
    case ADD_TO_TEAM + '_PENDING':
      return state
    case ADD_TO_TEAM + '_FULFILLED':
      console.log("Reducer fired!")
      return state.userTeam.map((element, i) => {
        if(i === action.payload[1])
          return action.payload[0]
        else
          return element
      })
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

export function addToTeam(promise, index) {
  console.log("AddToTeam fired!")
  return {
    type: ADD_TO_TEAM,
    payload: [promise, index]
  }
}
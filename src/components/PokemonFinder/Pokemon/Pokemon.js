import React, {Component} from 'react'
import {connect} from 'react-redux'
import dispatchGetPokemon from '../../../services/pokemonService'

import './Pokemon.css'

class Pokemon extends Component {

  componentWillReceiveProps(newProps) {
    console.log(newProps.name, this.props.name)
    if (newProps.name && newProps.name !== this.props.name)
      dispatchGetPokemon(newProps.name)
  }

  render() {
    // if (!this.props.name)
    //   return null
    if(this.props.pokemon.sprites) {
      var sprite = this.props.pokemon.sprites.front_default
    }

    return (
      <div>
        <div className="pokemon-name">
          {this.props.pokemon.name}
        </div>
        <div> <img src={sprite} /> </div>

      <div className="type-container">
        {this.props.pokemon.types ? this.props.pokemon.types.map((element, i) => {
          return <div className="type" style={{backgroundColor: getColor(element.type.name)}} key={i}>{element.type.name.toUpperCase().substring(0,6)}</div>
        }) : "Loading..."}
      </div>
      </div>
    )
  }
}

function getColor (element) {
  console.log(element)
  switch (element) {
    case "bug":
      return "#A8B821"
    case "fight":
      return "#C03028"
    case "ghost":
      return "#715899"
    case "electric":
      return "#F8D030"
    case "flying":
      return "#A890F0"
    case "steel":
      return "#B8B8D0"
    case "psychic":
      return "#F85888"
    case "poison":
      return "#A040A1"
    case "fire":
      return "#F07F2F"
    case "ice":
      return "#98D8D8"
    case "ground":
      return "#E0C069"
    case "water":
      return "#6890F0"
    case "dragon":
      return "#7038F9"
    case "rock":
      return "#B89F38"
    case "grass":
      return "#78C750"
    case "dark":
      return "#6F5848"
    case "fairy":
      return "#EB859E"
    default:
      return "#A9A878"
  }
}
function mapStateToProps(state) {
  console.log('map', state)
  return {
    pokemon: state.pokemon
  }
}

export default connect(mapStateToProps)(Pokemon)
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
    return (
      <div>
        <div className="pokemon-name">
          {this.props.pokemon.name}
        </div>
        <div> <img src={sprite} /> </div>

      <div className="type-container">
        {this.props.pokemon.types ? this.props.pokemon.types.map((element, i) => {
          return <div className="type" key={i}>{element.type.name.toUpperCase().substring(0,6)}</div>
        }) : "Loading..."}
      </div>
      </div>
    )
  }
}


function mapStateToProps(state) {
  console.log('map', state)
  return {
    pokemon: state.pokemon
  }
}

export default connect(mapStateToProps)(Pokemon)
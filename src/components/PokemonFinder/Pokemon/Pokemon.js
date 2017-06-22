import React, {Component} from 'react'
import {connect} from 'react-redux'
import dispatchGetPokemon from '../../../services/pokemonService'

class Pokemon extends Component {

  componentWillReceiveProps(newProps) {
    console.log(newProps.name, this.props.name)
    if (newProps.name && newProps.name !== this.props.name)
      dispatchGetPokemon(newProps.name)
  }

  render() {
    if (!this.props.name)
      return null

    return (
      <div>
        {this.props.pokemon.types ? this.props.pokemon.types.map((element, i) => {
          return <p key={i}>{element.type.name}</p>
        }) : "Loading..."}
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
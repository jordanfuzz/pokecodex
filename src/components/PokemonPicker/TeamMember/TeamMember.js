import React, {Component} from 'react'
import {connect} from 'react-redux'
import {dispatchAddToTeam} from '../../../services/pokemonService'


class TeamMember extends Component {

  componentWillMount() {
    console.log('compWillReceiveProps fired!', this.props)
    dispatchAddToTeam(this.props.name, this.props.index)
  }

  // componentWillReceiveProps(newProps) {
  //   if (newProps.name && newProps.name !== this.props.name)
  //     dispatchAddToTeam(newProps.name, this.props.index)
  // }

  render() {
    let pokemon = this.props.pokemonTeam[this.props.index]
    console.log('pokemon', this.props.pokemonTeam)

    if (!this.props.name)
      return null
    if(pokemon.sprites) {
      var sprite = pokemon.sprites.front_default
    }

    return (
      <div>
        <img alt={pokemon.name} className="sprite" src={sprite} />
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    pokemonTeam: state.userTeam
  }
}

export default connect(mapStateToProps)(TeamMember)
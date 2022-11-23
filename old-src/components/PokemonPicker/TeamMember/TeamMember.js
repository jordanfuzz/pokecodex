import React, {Component} from 'react'

import './TeamMember.css'

import add from "./add.svg"

class TeamMember extends Component {

  render() {
    if (!this.props.pokemon)
      return (
        <div><img className="add-icon" src={add} alt="Add Pokemon"/></div>
      )

    if(this.props.pokemon.sprites) {
      var sprite = this.props.pokemon.sprites.front_default
    }
    return (
      <div>
        <img alt={this.props.pokemon.name} className="sprite" src={sprite} />
      </div>
    )
  }
}

export default TeamMember
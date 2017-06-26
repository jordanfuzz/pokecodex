import React, {Component} from 'react'

class TeamMember extends Component {

  render() {
    if (!this.props.pokemon)
      return null
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
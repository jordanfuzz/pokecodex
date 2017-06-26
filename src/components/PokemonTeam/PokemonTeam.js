import React, {Component} from 'react'
import './PokemonTeam.css'
import TeamMember from '../PokemonPicker/TeamMember/TeamMember'

export default class PokemonTeam extends Component {
  constructor() {
    super()

    this.state = {
      userInput: "",
      pokemonName: ""
    }
    this.handleChange = this.handleChange.bind(this)
    this.handleSearch = this.handleSearch.bind(this)
    this.handleRandom = this.handleRandom.bind(this)
  }

  handleRandom() {
    this.setState({
      pokemonName: (Math.floor(Math.random() * 721) + 1).toString()
    })
  }

  handleChange(text) {
    this.setState({
      userInput: text
    })
  }

  handleSearch() {
    this.setState({
      pokemonName: this.state.userInput,
      userInput: ""
    })
  }

  render() {

    return (
      <div>
        
        <div className="pokemon-team">
          <div className="team-member"><TeamMember name="bulbasaur" index={0} /></div>
          <div className="team-member"><TeamMember name="nidoking" index={1} /></div>
          <div className="team-member"><TeamMember name="gengar" index={2} /></div>
          <div className="team-member"><TeamMember name="gengar" index={3} /></div>
          <div className="team-member"><TeamMember name="gengar" index={4} /></div>
          <div className="team-member"><TeamMember name="gengar" index={5} /></div>
        </div>
        
          <div className="input-container">
            <input className="console" type="text" placeholder="Enter a pokemon..." value={this.state.userInput}
                   onChange={(e) => this.handleChange(e.target.value)}/>
            <button className="add-button" onClick={this.handleSearch}>Add!</button>
          </div>
        </div>
    )
  }
}
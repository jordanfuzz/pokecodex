import React, {Component} from 'react'
import './PokemonPicker.css'
import Pokemon from '../PokemonFinder/Pokemon/Pokemon'
import TeamMember from './TeamMember/TeamMember'

export default class PokemonPicker extends Component {
  constructor() {
    super()

    this.state = {
      userInput: "",
      pokemonName: "",
      effectivePokemon: null
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
      <div className="component-container">
        
        <div className="pokemon-team">
          <div className="team-member"><TeamMember name="bulbasaur" index={0} /></div>
          <div className="team-member"><TeamMember name="nidoking" index={1} /></div>
          <div className="team-member"><TeamMember name="gengar" index={2} /></div>
          <div className="team-member"><TeamMember name="gengar" index={3} /></div>
          <div className="team-member"><TeamMember name="gengar" index={4} /></div>
          <div className="team-member"><TeamMember name="gengar" index={5} /></div>
        </div>

        <div className="wild-pokemon-section">
          <div className="pokemon-display-container">
            <Pokemon name={this.state.pokemonName} />
          </div>
          <div className="input-container">
            <input className="console" type="text" placeholder="Enter a pokemon..." value={this.state.userInput}
                   onChange={(e) => this.handleChange(e.target.value)}/>
            <button className="find-button" onClick={this.handleSearch}>Find!</button>
            <button className="random-button" onClick={this.handleRandom}>Random!</button>
          </div>
        </div>
      </div>
    )
  }
}
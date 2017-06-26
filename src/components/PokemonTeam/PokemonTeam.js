import React, {Component} from 'react'
import './PokemonTeam.css'
import TeamMember from '../PokemonPicker/TeamMember/TeamMember'
import {dispatchAddToTeam} from '../../services/pokemonService'

export default class PokemonTeam extends Component {
  constructor() {
    super()

    this.state = {
      userInput: "",
      addingPokemon: false,
      currentSlot: null
    }
    this.handleChange = this.handleChange.bind(this)
    this.handleAdd = this.handleAdd.bind(this)
    this.handleSelect = this.handleSelect.bind(this)
  }


  handleSelect(slot) {
    this.setState({
      addingPokemon: true,
      currentSlot: slot
    })
  }

  handleChange(text) {
    this.setState({
      userInput: text
    })
  }

  handleAdd() {
    dispatchAddToTeam(this.state.userInput, this.state.currentSlot)

    this.setState({
      userInput: "",
      addingPokemon: false,
      currentSlot: null
    })

  }

  render() {

    return (
      <div>
        <div className="pokemon-team">
          <div className="team-member" onClick={() => this.handleSelect(0)}><TeamMember name="bulbasaur" index={0} /></div>
          <div className="team-member" onClick={() => this.handleSelect(1)}><TeamMember name="nidoking" index={1} /></div>
          <div className="team-member" onClick={() => this.handleSelect(2)}><TeamMember name="gengar" index={2} /></div>
          <div className="team-member" onClick={() => this.handleSelect(3)}><TeamMember name="gengar" index={3} /></div>
          <div className="team-member" onClick={() => this.handleSelect(4)}><TeamMember name="gengar" index={4} /></div>
          <div className="team-member" onClick={() => this.handleSelect(5)}><TeamMember name="gengar" index={5} /></div>
        </div>
        
          <div className={`input-container ${this.state.addingPokemon ? "" : "hide-console"}`}>
            <input className="console" type="text" placeholder="Enter a pokemon..." value={this.state.userInput}
                   onChange={(e) => this.handleChange(e.target.value)}/>
            <button className="add-button" onClick={this.handleAdd}>Add!</button>
          </div>
      </div>
    )
  }
}
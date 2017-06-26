import React, {Component} from 'react'
import './PokemonTeam.css'
import TeamMember from '../PokemonPicker/TeamMember/TeamMember'
import {dispatchAddToTeam} from '../../services/pokemonService'
import {connect} from 'react-redux'

class PokemonTeam extends Component {
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
    dispatchAddToTeam(this.state.userInput)

    this.setState({
      userInput: "",
      addingPokemon: false,
      currentSlot: null
    })

  }

  render() {

    return (
      <div>
        <h1 className="team-header">Your Pokemon Team</h1>
        
        <div className="pokemon-team-container">
          <div className="team-member" onClick={() => this.handleSelect(0)}><TeamMember pokemon={this.props.pokemonTeam[0]} index={0} /></div>
          <div className="team-member" onClick={() => this.handleSelect(1)}><TeamMember pokemon={this.props.pokemonTeam[1]} index={1} /></div>
          <div className="team-member" onClick={() => this.handleSelect(2)}><TeamMember pokemon={this.props.pokemonTeam[2]} index={2} /></div>
          <div className="team-member" onClick={() => this.handleSelect(3)}><TeamMember pokemon={this.props.pokemonTeam[3]} index={3} /></div>
          <div className="team-member" onClick={() => this.handleSelect(4)}><TeamMember pokemon={this.props.pokemonTeam[4]} index={4} /></div>
          <div className="team-member" onClick={() => this.handleSelect(5)}><TeamMember pokemon={this.props.pokemonTeam[5]} index={5} /></div>
        </div>
        
          <div className={`console-container ${this.state.addingPokemon ? "" : "hide-console"}`}>
            <input className="console" type="text" placeholder="Enter a pokemon..." value={this.state.userInput}
                   onChange={(e) => this.handleChange(e.target.value)}/>
            <button className="add-button" onClick={this.handleAdd}>Add!</button>
          </div>
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    pokemonTeam: state.userTeam
  }
}



export default connect(mapStateToProps)(PokemonTeam)
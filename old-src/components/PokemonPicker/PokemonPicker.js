import React, {Component} from 'react'
import './PokemonPicker.css'
import Pokemon from '../PokemonFinder/Pokemon/Pokemon'
import TeamMember from './TeamMember/TeamMember'
import {connect} from 'react-redux'
import {dispatchAddType} from './../../services/pokemonService'

class PokemonPicker extends Component {
  constructor() {
    super()

    this.state = {
      userInput: "",
      pokemonName: "",
      effectivePokemon: null,
      wildPokemon: ""
    }
    this.handleChange = this.handleChange.bind(this)
    this.handleSearch = this.handleSearch.bind(this)
    this.handleRandom = this.handleRandom.bind(this)
    this.getPokemon = this.getPokemon.bind(this)
    this.findEffectivePokemon = this.findEffectivePokemon.bind(this)

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
      pokemonName: this.state.userInput.toLowerCase(),
      userInput: ""
    })
  }
  
  getPokemon(pokemon) {
    this.setState({
      wildPokemon: pokemon
    })

    
  }

  findEffectivePokemon() {

    //where do I put this?

    this.state.wildPokemon.types.forEach((element) => {dispatchAddType(element.type.name)})
  }
  
  render() {
    
    return (
      <div>
        <div className="component-container">

          <div className="pokemon-team">
            <div className="team-member"><TeamMember pokemon={this.props.pokemonTeam[0]} index={0} /></div>
            <div className="team-member"><TeamMember pokemon={this.props.pokemonTeam[1]} index={1} /></div>
            <div className="team-member"><TeamMember pokemon={this.props.pokemonTeam[2]} index={2} /></div>
            <div className="team-member"><TeamMember pokemon={this.props.pokemonTeam[3]} index={3} /></div>
            <div className="team-member"><TeamMember pokemon={this.props.pokemonTeam[4]} index={4} /></div>
            <div className="team-member"><TeamMember pokemon={this.props.pokemonTeam[5]} index={5} /></div>
          </div>

          <div className="wild-pokemon-section">
            <h1 className="picker-header">Pokemon Picker</h1>
            <div className="pokemon-display-container">
              <Pokemon name={this.state.pokemonName} getPokemon={this.getPokemon} />
            </div>
            <div className="input-container">
              <input className="console" type="text" placeholder="Enter a pokemon..." value={this.state.userInput}
                     onChange={(e) => this.handleChange(e.target.value)}/>
              <button className="find-button" onClick={this.handleSearch}>Find!</button>
              <button className="random-button" onClick={this.handleRandom}>Random!</button>
            </div>
            <button className="calculate-button" onClick={this.findEffectivePokemon}>Calculate!</button>
          </div>

        </div>
        <div className="results">
          {this.state.wildPokemon && this.props.effectivePokemon && this.props.resultsReady ?
            `${this.props.effectivePokemon.name.charAt(0).toUpperCase() +
            this.props.effectivePokemon.name.slice(1)}
            is most effective against ${this.state.wildPokemon.name.charAt(0).toUpperCase() +
            this.state.wildPokemon.name.slice(1)}!` : ""}
        </div>
      </div>
    )
  }
}

function mapStateToProps(state) {
  if (!state.types)
    return { pokemonTeam: state.userTeam }


  console.log('state', state)
  if(state.types) {
    let wildTypes = state.types

    let effectivenessArray = []
    state.userTeam.forEach((userPokemon) => {
      var effectiveness = 0
      wildTypes.forEach((wildType) => {
        let noDamage = wildType.damage_relations.no_damage_from.map((element) => {return element.name})
        let halfDamage = wildType.damage_relations.half_damage_from.map((element) => {return element.name})
        let doubleDamage = wildType.damage_relations.double_damage_from.map((element) => {return element.name})
        userPokemon.types.forEach((userType) => {
          if(noDamage.includes(userType.type.name)) {
            effectiveness -= 2
          }
          else if(halfDamage.includes(userType.type.name)) {
            effectiveness--
          }
          else if(doubleDamage.includes(userType.type.name)){
            effectiveness++
          }
        })
      })
      effectivenessArray.push(effectiveness)
    })
    
    console.log(effectivenessArray)
    let max = Math.max.apply(null, effectivenessArray)

    return {
      pokemonTeam: state.userTeam,
      effectivePokemon: state.userTeam[effectivenessArray.indexOf(max)],
      resultsReady: state.resultsReady
    }
  }
}

export default connect(mapStateToProps)(PokemonPicker)
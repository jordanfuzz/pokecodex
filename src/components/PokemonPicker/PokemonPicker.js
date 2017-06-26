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
      pokemonName: this.state.userInput,
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

    let wildTypes = this.props.typeArray

    let effectivenessArray = []
    this.props.pokemonTeam.forEach((userPokemon) => {
      var effectiveness = 0
      wildTypes.forEach((wildType) => {
        let noDamage = wildType.damage_relations.no_damage_from.map((element) => {return element.name})
        let halfDamage = wildType.damage_relations.half_damage_from.map((element) => {return element.name})
        let doubleDamage = wildType.damage_relations.double_damage_from.map((element) => {return element.name})
        userPokemon.types.forEach((userType) => {
          console.log(noDamage, halfDamage, doubleDamage)
          if(noDamage.includes(userType)) {
            effectiveness -= 2
          }
          else if(halfDamage.includes(userType)) {
            effectiveness--
            console.log("not very effective")
          }
          else if(doubleDamage.includes(userType)){
            effectiveness++
            console.log("it's super effective!")
          }
        })
      })
      effectivenessArray.push(effectiveness)
    })

    console.log(effectivenessArray)

    let max = Math.max.apply(null, effectivenessArray)

    this.setState({
      effectivePokemon: this.props.pokemonTeam[effectivenessArray.indexOf(max)]
    })
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
          {this.state.wildPokemon && this.state.effectivePokemon ? `${this.state.effectivePokemon.name} is most effective against ${this.state.wildPokemon.name}!` : ""}
        </div>
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    pokemonTeam: state.userTeam,
    typeArray: state.types
  }
}

export default connect(mapStateToProps)(PokemonPicker)
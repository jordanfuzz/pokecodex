import React, { useState } from 'react'
import Select from 'react-select'
import { multiSelectStyles, singleSelectStyles } from './catch.logic'
import './catch.scss'

const Catch = props => {
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGameVersion, setSelectedGameVersion] = useState(null)
  const [selectedPokeball, setSelectedPokeball] = useState(1)

  if (!props.activePokemonSources || !props.catchData) return null

  const sourceOptions = props.activePokemonSources.map(x => {
    const label = (
      <span className="option-container">
        <img
          src={x.image ? x.image : props.activePokemon.defaultImage}
          className="source-option-image"
        />
        {x.name}
      </span>
    )
    return { value: x.id, label }
  })

  const pokeballOptions = props.catchData.pokeballs.map(x => {
    const label = <img src={x.image} className="pokeball-option-image" />

    return { value: x.id, label }
  })

  const gameVersionOptions = props.catchData.gameVersions.map(x => ({
    value: x.id,
    label: x.name,
  }))

  const handleSubmitClick = () => {
    if (selectedSources.length && selectedGameVersion && selectedPokeball)
      props.logCatch({
        sources: selectedSources,
        pokeball: selectedPokeball,
        gameVersion: selectedGameVersion,
        pokemonId: props.activePokemon.id,
      })
  }

  return (
    <div className="catch-mode-container">
      <div className="dropdown-container">
        <div className="main-dropdown">
          <Select
            options={sourceOptions}
            styles={multiSelectStyles}
            isSearchable={false}
            isMulti={true}
            onChange={options => setSelectedSources(options.map(x => x.value))}
          />
        </div>
        <div className="game-version-dropdown">
          <Select
            options={gameVersionOptions}
            styles={singleSelectStyles}
            isSearchable={false}
            onChange={option => setSelectedGameVersion(option?.value)}
          />
        </div>
        <div className="pokeball-dropdown">
          <Select
            options={pokeballOptions}
            styles={singleSelectStyles}
            isSearchable={false}
            placeholder={
              <img
                className="pokeball-placeholder"
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
              />
            }
            onChange={option => setSelectedPokeball(option?.value)}
          />
        </div>
      </div>
      <div
        className={`catch-confirm-button button-color-${props.activePokemon.type1}`}
        onClick={handleSubmitClick}
      >
        Log catch
      </div>
    </div>
  )
}

export default Catch

import React, { useState } from 'react'
import Select from 'react-select'
import { isDate } from 'validator'
import { multiSelectStyles, singleSelectStyles } from './catch.logic'
import './catch.scss'

const Catch = props => {
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGameVersion, setSelectedGameVersion] = useState(null)
  const [selectedPokeball, setSelectedPokeball] = useState(1)
  const [isEditDateMode, setIsEditDateMode] = useState(false)
  const [updatedDate, setUpdatedDate] = useState('')
  const [isDateError, setIsDateError] = useState(false)

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
    if (!selectedSources.length || !selectedGameVersion || !selectedPokeball) return

    let date
    if (props.isEditMode) {
      if (updatedDate) {
        if (!isDate(updatedDate)) {
          setIsDateError(true)
          return
        } else {
          setIsDateError(false)
          date = updatedDate ? new Date(updatedDate) : null
        }
      } else {
        date = props.activeUsersPokemon.caughtAt
      }
    }

    const pokemonData = {
      sources: selectedSources,
      pokeball: selectedPokeball,
      gameVersion: selectedGameVersion,
      pokemonId: props.activePokemon.id,
    }
    if (props.isEditMode) {
      pokemonData.usersPokemonId = props.activeUsersPokemon.id
      pokemonData.caughtAt = date
    }
    props.handleSubmit(pokemonData)
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
      {props.isEditMode ? (
        <>
          <span className="edit-date-container">
            <span className="edit-date-label">Date:</span>
            <input
              className="edit-date-input"
              placeholder={props.activeUsersPokemon?.caughtAt}
              value={updatedDate}
              disabled={!isEditDateMode}
              onChange={e => setUpdatedDate(e.target.value)}
            />
            {isEditDateMode ? (
              <button
                className="edit-date-button"
                onClick={() => setIsEditDateMode(false)}
              >
                Save
              </button>
            ) : (
              <button
                className="edit-date-button"
                onClick={() => setIsEditDateMode(true)}
              >
                Edit
              </button>
            )}
            {isDateError ? (
              <span className="edit-date-error">Date is invalid!</span>
            ) : null}
          </span>
          <span className="delete-button-container">
            <button className="delete-pokemon-button">Delete Pokemon</button>
          </span>
          <div className="drawer-button-container">
            {/* Add hover effect to buttons */}
            {/* Rename class */}
            <span className="show-catches-button" onClick={props.handleCancel}>
              Cancel
            </span>
            {/* Rename class */}
            <span className="log-catch-button" onClick={handleSubmitClick}>
              Update pokemon
            </span>
          </div>
        </>
      ) : (
        <div
          className={`catch-confirm-button button-color-${props.activePokemon.type1}`}
          onClick={handleSubmitClick}
        >
          Log catch
        </div>
      )}
    </div>
  )
}

export default Catch

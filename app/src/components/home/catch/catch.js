import React, { useState, useEffect } from 'react'
import Select from 'react-select'
import { isDate } from 'validator'
import { DateTime } from 'luxon'
import { DateTimePicker } from '@mui/x-date-pickers'
import { multiSelectStyles, singleSelectStyles } from './catch.logic'
import './catch.scss'

const Catch = props => {
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGameVersion, setSelectedGameVersion] = useState(null)
  const [selectedPokeball, setSelectedPokeball] = useState(1)
  const [isEditDateMode, setIsEditDateMode] = useState(false)
  const [updatedDate, setUpdatedDate] = useState('')
  const [isDateError, setIsDateError] = useState(false)
  const [isFlaggedForDeletion, setIsFlaggedForDeletion] = useState(false)

  if (!props.activePokemonSources || !props.catchData) return null

  useEffect(() => {
    if (!props.isEditMode) return

    setSelectedSources(
      props.usersPokemonSources
        .filter(x => x.pokemonId === props.activeUsersPokemon.id)
        .map(x => x.id)
    )
    setSelectedGameVersion(
      props.catchData.gameVersions.find(
        x => x.name === props.activeUsersPokemon.gameVersion
      ).id
    )
    setSelectedPokeball(props.activeUsersPokemon.pokeball)
  }, [])

  const sourceOptions = props.activePokemonSources.map((x, i) => {
    const label = (
      <span className="option-container" key={i}>
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
        console.log(updatedDate)
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

  const handleConfirmDelete = () => {
    const pokemonData = {
      usersPokemonId: props.activeUsersPokemon.id,
      pokemonId: props.activePokemon.id,
    }
    props.handleDelete(pokemonData)
    setIsFlaggedForDeletion(false)
  }

  const renderDeleteConfirmation = () => {
    return (
      <div className="delete-mode-container">
        <span className="deletion-warning">
          Are you sure you want to delete this catch?
        </span>
        <span className="confirm-delete-container">
          <button className="confirm-delete-button" onClick={handleConfirmDelete}>
            Yes
          </button>
          <button
            className="confirm-delete-button"
            onClick={() => {
              setIsFlaggedForDeletion(false)
            }}
          >
            No
          </button>
        </span>
      </div>
    )
  }

  return isFlaggedForDeletion ? (
    renderDeleteConfirmation()
  ) : (
    <div className="catch-mode-container">
      <div className="dropdown-container">
        <div className="main-dropdown">
          <Select
            options={sourceOptions}
            styles={multiSelectStyles}
            isSearchable={false}
            isMulti={true}
            onChange={options => setSelectedSources(options.map(x => x.value))}
            value={sourceOptions.filter(x => selectedSources?.includes(x.value))}
          />
        </div>
        <div className="game-version-dropdown">
          <Select
            options={gameVersionOptions}
            styles={singleSelectStyles}
            isSearchable={false}
            onChange={option => setSelectedGameVersion(option?.value)}
            value={gameVersionOptions.filter(x => selectedGameVersion === x.value)}
          />
        </div>
        <div className="pokeball-dropdown">
          <Select
            options={pokeballOptions}
            styles={singleSelectStyles}
            isSearchable={false}
            onChange={option => setSelectedPokeball(option?.value)}
            value={pokeballOptions.filter(x => selectedPokeball === x.value)}
          />
        </div>
      </div>
      {props.isEditMode ? (
        <>
          <span className="edit-date-container">
            <span className="edit-date-label">Date:</span>
            <DateTimePicker
              className="edit-date-picker"
              sx={{ color: 'red' }}
              slotProps={{
                textField: {
                  className: 'edit-date-input',
                },
              }}
            />
            {/* <input
              className="edit-date-input"
              placeholder={
                props.activeUsersPokemon
                  ? DateTime.fromISO(props.activeUsersPokemon.caughtAt).toFormat('D t')
                  : null
              }
              value={updatedDate}
              disabled={!isEditDateMode}
              onChange={e => setUpdatedDate(e.target.value)}
            /> */}
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
            <button
              className="delete-pokemon-button"
              onClick={() => setIsFlaggedForDeletion(true)}
            >
              Delete Pokemon
            </button>
          </span>
          <div className="drawer-button-container">
            <span
              className={`show-catches-button button-color-${props.activePokemon.type1}`}
              onClick={props.handleCancel}
            >
              Cancel
            </span>
            <span
              className={`log-catch-button button-color-${props.activePokemon.type1}`}
              onClick={handleSubmitClick}
            >
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

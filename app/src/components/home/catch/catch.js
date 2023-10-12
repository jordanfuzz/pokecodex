import React, { useState, useEffect } from 'react'
import Select from 'react-select'
import { DateTime } from 'luxon'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { DateTimePicker } from '@mui/x-date-pickers'
import { multiSelectStyles, singleSelectStyles } from './catch.logic'
import './catch.scss'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

const Catch = props => {
  const [selectedSources, setSelectedSources] = useState([])
  const [selectedGameVersion, setSelectedGameVersion] = useState(null)
  const [selectedPokeball, setSelectedPokeball] = useState(1)
  const [updatedDate, setUpdatedDate] = useState(null)
  const [isDateError, setIsDateError] = useState(false)
  const [isFlaggedForDeletion, setIsFlaggedForDeletion] = useState(false)

  const {
    activePokemon,
    activePokemonSources,
    usersPokemonSources,
    isEditMode,
    catchData,
    activeUsersPokemon,
    handleSubmit,
    handleDelete,
    handleCancel,
  } = props

  if (!activePokemonSources || !catchData) return null

  useEffect(() => {
    if (!isEditMode) return

    setSelectedSources(
      usersPokemonSources
        .filter(x => x.pokemonId === activeUsersPokemon.id)
        .map(x => x.id)
    )
    setSelectedGameVersion(
      catchData.gameVersions.find(x => x.name === activeUsersPokemon.gameVersion).id
    )
    setSelectedPokeball(activeUsersPokemon.pokeball)
    setUpdatedDate(activeUsersPokemon.caughtAt)
  }, [])

  const sourceOptions = activePokemonSources.map((x, i) => {
    const label = (
      <span className="option-container" key={i}>
        <img
          src={x.image ? x.image : activePokemon.defaultImage}
          className="source-option-image"
        />
        {x.name}
      </span>
    )
    return { value: x.id, label }
  })

  const pokeballOptions = catchData.pokeballs.map(x => {
    const label = <img src={x.image} className="pokeball-option-image" />

    return { value: x.id, label }
  })

  const gameVersionOptions = catchData.gameVersions.map(x => ({
    value: x.id,
    label: x.name,
  }))

  const handleSubmitClick = () => {
    if (!selectedSources.length || !selectedGameVersion || !selectedPokeball) return

    let date

    if (isEditMode) {
      if (updatedDate) {
        const isValidDate = DateTime.fromISO(updatedDate).isValid
        if (!isValidDate) {
          setIsDateError(true)
          return
        } else {
          setIsDateError(false)
          date = updatedDate ? new Date(updatedDate) : null
        }
      } else {
        date = activeUsersPokemon.caughtAt
      }
    }

    const pokemonData = {
      sources: selectedSources,
      pokeball: selectedPokeball,
      gameVersion: selectedGameVersion,
      pokemonId: activePokemon.id,
    }
    if (isEditMode) {
      pokemonData.usersPokemonId = activeUsersPokemon.id
      pokemonData.caughtAt = date
    }
    handleSubmit(pokemonData)
  }

  const handleConfirmDelete = () => {
    const pokemonData = {
      usersPokemonId: activeUsersPokemon.id,
      pokemonId: activePokemon.id,
    }
    handleDelete(pokemonData)
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
      {isEditMode ? (
        <>
          <span className="edit-date-container">
            <span className="edit-date-label">Date:</span>
            <ThemeProvider theme={darkTheme}>
              <DateTimePicker
                className="edit-date-picker"
                slotProps={{
                  textField: {
                    className: 'no-border',
                    style: {
                      padding: '0 10px 0 15px',
                      maxWidth: '205px',
                      color: 'black',
                    },
                    variant: 'standard',
                  },
                }}
                value={updatedDate ? DateTime.fromISO(updatedDate) : null}
                onChange={newDate => setUpdatedDate(newDate.toISO())}
              />
            </ThemeProvider>
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
              className={`show-catches-button button-color-${activePokemon.type1}`}
              onClick={handleCancel}
            >
              Cancel
            </span>
            <span
              className={`log-catch-button button-color-${activePokemon.type1}`}
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

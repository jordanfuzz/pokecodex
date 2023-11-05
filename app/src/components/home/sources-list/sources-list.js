import React, { useState } from 'react'
import Modal from 'react-modal'
import { uniq, uniqBy } from 'ramda'
import { DateTime } from 'luxon'
import { ArrowBigUpDash, Check } from 'lucide-react'
import Catch from '../catch/catch'
import './sources-list.scss'

const modalStyles = {
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#131418',
    padding: '40px',
    border: 'none',
  },
}

const SourcesList = props => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [openDrawerIndex, setOpenDrawerIndex] = useState(null)
  const [drawerMode, setDrawerMode] = useState('log')
  const [noteText, setNoteText] = useState('')
  const [hoveredEvolveButtonId, setHoveredEvolveButtonId] = useState(null)
  const [pokemonToEvolve, setPokemonToEvolve] = useState(null)
  const [isFlaggedForEvolution, setIsFlaggedForEvolution] = useState(false)
  const [targetEvolution, setTargetEvolution] = useState(null)

  if (!props.activePokemonSources || !props.usersPokemonSources) return null

  const activePokemonEvolves = !!props.activePokemon.evolvesTo

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleOpenDrawer = async pokemonId => {
    if (openDrawerIndex === pokemonId) {
      setOpenDrawerIndex(null)
      setDrawerMode('log')
    } else setOpenDrawerIndex(pokemonId)
  }

  const handleNoteClick = noteText => {
    setNoteText(noteText)
    setDrawerMode('note')
  }

  const handleUpdateNote = pokemon => {
    if (!noteText) return

    const noteData = {
      pokemonId: pokemon.pokemonId,
      usersPokemonId: pokemon.id,
      note: noteText,
    }
    props.handleUpdatePokemonNote(noteData)
    setDrawerMode('log')
    setOpenDrawerIndex(null)
  }

  const handleUpdateUsersPokemon = pokemonData => {
    props.handleUpdateUsersPokemon(pokemonData)
    setDrawerMode('log')
    setOpenDrawerIndex(null)
  }

  const handleDeleteUsersPokmemon = pokemonData => {
    props.handleDeleteUsersPokemon(pokemonData)
    setDrawerMode('log')
    setOpenDrawerIndex(null)
  }

  const handleEvolveButtonClick = (event, pokemon) => {
    setPokemonToEvolve(pokemon)
    setDrawerMode('evolve')
    setOpenDrawerIndex(pokemon.id)
    event.stopPropagation()
    event.preventDefault()
  }

  const handleEvolutionClick = evolution => {
    setTargetEvolution(evolution)
    setIsFlaggedForEvolution(true)
  }

  const handleConfirmEvolve = () => {
    const oldPokemonData = { ...pokemonToEvolve, pokemonId: props.activePokemon.id }
    props.handleEvolvePokemon(oldPokemonData, targetEvolution.id)
    setDrawerMode('log')
    setOpenDrawerIndex(null)
    setIsFlaggedForEvolution(false)
    setTargetEvolution(null)
    setIsModalOpen(false)
  }

  const renderEvolveConfirmation = () => {
    return (
      <div className="evolve-mode-container">
        <span className="evolution-warning">
          Do you want to evolve {props.activePokemon.name} into {targetEvolution.name}?
        </span>
        <span className="confirm-evolve-container">
          <button className="confirm-evolve-button" onClick={handleConfirmEvolve}>
            Yes
          </button>
          <button
            className="confirm-evolve-button"
            onClick={() => {
              setIsFlaggedForEvolution(false)
              setTargetEvolution(null)
              setDrawerMode('log')
              setOpenDrawerIndex(null)
            }}
          >
            No
          </button>
        </span>
      </div>
    )
  }

  const renderSources = () => {
    const sortSources = sourceArray => {
      let staticSources = []

      const starterSource = sourceArray.find(x => x.source === 'starter')
      const wildSource = sourceArray.find(x => x.source === 'wild')
      const hatchSource = sourceArray.find(x => x.source === 'hatch')
      const maleSource = sourceArray.find(x => x.source === 'male')
      const femaleSource = sourceArray.find(x => x.source === 'female')
      if (starterSource) staticSources.push(Object.assign({}, starterSource))
      if (wildSource) staticSources.push(Object.assign({}, wildSource))
      if (hatchSource) staticSources.push(Object.assign({}, hatchSource))
      if (maleSource) staticSources.push(Object.assign({}, maleSource))
      if (femaleSource) staticSources.push(Object.assign({}, femaleSource))
      const sortedSources = sourceArray
        .filter(x => !['starter', 'wild', 'hatch', 'male', 'female'].includes(x.source))
        .sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0))
      return staticSources.concat(sortedSources)
    }

    const uniqueUsersSourceIds = uniq(props.usersPokemonSources.map(x => x.id))

    let rawUnachievedSources = []
    let rawEvolutionSources = []

    if (!props.usersPokemonEvolutionSources?.length) {
      rawUnachievedSources = sortSources(
        props.activePokemonSources.filter(x => !uniqueUsersSourceIds.includes(x.id))
      )
    } else {
      sortSources(
        props.activePokemonSources.filter(x => !uniqueUsersSourceIds.includes(x.id))
      ).forEach(source => {
        if (props.usersPokemonEvolutionSources.some(x => x.id === source.id))
          rawEvolutionSources.push(source)
        else rawUnachievedSources.push(source)
      })
    }

    const unachievedSources = rawUnachievedSources.map((source, i) => {
      return (
        <span key={`normal-${i}`} className="locked-source-pill">
          {source.name}
        </span>
      )
    })

    const evolutionAchievedSources = rawEvolutionSources.map((source, i) => {
      return (
        <span key={`evo-${i}`} className="unlocked-source-pill">
          <ArrowBigUpDash className="evolve-icon" color="white" size={30} />
          {source.name}
        </span>
      )
    })

    const achievedSources = sortSources(
      uniqBy(source => source.id, props.usersPokemonSources)
    )
      .filter(x => !x.isInherited)
      .map((source, i) => (
        <span key={`achieved-${i}`} className="unlocked-source-pill">
          <Check className="check-icon" color="white" size={25} strokeWidth={3.5} />
          {source.name}
        </span>
      ))

    return [achievedSources, evolutionAchievedSources, unachievedSources]
  }

  const renderUsersPokemonDrawer = pokemon => {
    let drawerContents

    switch (drawerMode) {
      case 'log':
        drawerContents = (
          <td className="note-drawer-column" colSpan="6">
            {
              <span className="note-text">
                {pokemon.notes ? pokemon.notes : 'No note text...'}
              </span>
            }
            <div className="drawer-button-container">
              <span
                className={`show-catches-button button-color-${props.activePokemon.type1}`}
                onClick={() => handleNoteClick(pokemon.notes || '')}
              >
                Edit note
              </span>
              <span
                className={`log-catch-button button-color-${props.activePokemon.type1}`}
                onClick={() => setDrawerMode('edit')}
              >
                Edit catch data
              </span>
            </div>
          </td>
        )
        break
      case 'note':
        drawerContents = (
          <td className="drawer-column" colSpan="6">
            <textarea
              className="note-editor"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <div className="drawer-button-container">
              <span
                className={`show-catches-button button-color-${props.activePokemon.type1}`}
                onClick={() => setDrawerMode('log')}
              >
                Cancel
              </span>
              <span
                className={`log-catch-button button-color-${props.activePokemon.type1}`}
                onClick={() => handleUpdateNote(pokemon)}
              >
                Update note
              </span>
            </div>
          </td>
        )
        break
      case 'edit':
        drawerContents = (
          <td className="drawer-column" colSpan="6">
            <div className="edit-fields-container">
              <Catch
                activePokemonSources={props.activePokemonSources}
                usersPokemon={props.usersPokemon}
                usersPokemonSources={props.usersPokemonSources}
                catchData={props.catchData}
                activePokemon={props.activePokemon}
                activeUsersPokemon={pokemon}
                isEditMode={true}
                handleCancel={() => setDrawerMode('log')}
                handleSubmit={handleUpdateUsersPokemon}
                handleDelete={handleDeleteUsersPokmemon}
              />
            </div>
          </td>
        )
        break
      case 'evolve':
        drawerContents = (
          <td className="drawer-column" colSpan="6">
            {isFlaggedForEvolution ? (
              renderEvolveConfirmation()
            ) : (
              <>
                <span className="evolve-to-label">Evolve to:</span>
                <div className="evolution-choices-container">
                  {props.activePokemon.evolutions.map((evolution, i) => (
                    <div
                      className="evolution-choice"
                      key={i}
                      onClick={() => handleEvolutionClick(evolution)}
                    >
                      <img
                        className="evolution-choice-image"
                        src={evolution.defaultImage}
                      />
                      <span className="evolution-choice-label">{evolution.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </td>
        )
        break
      default:
        drawerContents = null
        break
    }

    return (
      <tr className={`data-row-drawer drawer-${props.activePokemon?.type1}`}>
        {drawerContents}
      </tr>
    )
  }

  const renderPokemonRows = () => {
    if (!props.usersPokemon) return null

    const renderTags = pokemon => {
      const allUsersSources = props.usersPokemonSources
        ? props.usersPokemonSources.filter(x => x.pokemonId === pokemon.id)
        : []

      const inheritedSources = allUsersSources.reduce((acc, source) => {
        if (source.isInherited) {
          acc.push(source)
          return acc
        }
        return acc
      }, [])

      const nonInheritedSources = allUsersSources.filter(source => !source.isInherited)

      const nonInheritedTags = nonInheritedSources.map((source, i) => (
        <span key={`non-${i}`} className="catch-tag">
          {source.name}
        </span>
      ))

      const inheritedTags = inheritedSources.map((source, i) => (
        <span key={`inherit-${i}`} className="catch-tag inherited">
          {source.name}
        </span>
      ))

      return [...nonInheritedTags, ...inheritedTags]
    }

    return props.usersPokemon.map((pokemon, i) => {
      return (
        <React.Fragment key={i}>
          <tr
            className={`pokemon-data-row hover-${props.activePokemon?.type1} ${
              openDrawerIndex === pokemon.id ? `active-${props.activePokemon?.type1}` : ''
            }`}
            onClick={() => handleOpenDrawer(pokemon.id)}
          >
            {activePokemonEvolves ? (
              <td
                onMouseEnter={() => setHoveredEvolveButtonId(i)}
                onMouseLeave={() => setHoveredEvolveButtonId(null)}
              >
                <ArrowBigUpDash
                  onClick={event => handleEvolveButtonClick(event, pokemon)}
                  className="catch-list-evolve-button"
                  color={hoveredEvolveButtonId === i ? 'black' : 'white'}
                  size={30}
                />
              </td>
            ) : null}
            <td>{pokemon.gen}</td>
            <td>{pokemon.gameVersion}</td>
            <td>
              <img
                src={
                  props.catchData?.pokeballs.find(x => x.id === pokemon.pokeball)?.image
                }
                className="catch-table-pokeball"
              />
            </td>
            <td>{DateTime.fromISO(pokemon.caughtAt).toFormat('D t')}</td>
            <td className="tags-column">
              <span className="tag-container">{renderTags(pokemon)}</span>
            </td>
          </tr>
          {openDrawerIndex === pokemon.id ? renderUsersPokemonDrawer(pokemon) : null}
        </React.Fragment>
      )
    })
  }

  return (
    <>
      <div className="pokemon-sources-container">{renderSources()}</div>
      <div className="drawer-button-container">
        <span
          className={`show-catches-button button-color-${props.activePokemon.type1}`}
          onClick={handleOpenModal}
        >
          Show catches
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            className="button-icon"
          />
        </span>
        <span
          className={`log-catch-button button-color-${props.activePokemon.type1}`}
          onClick={() => props.setDrawerMode('catch')}
        >
          Log new catch
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rule-book.png"
            className="button-icon"
          />
        </span>
      </div>
      <Modal isOpen={isModalOpen} onRequestClose={handleCloseModal} style={modalStyles}>
        <div className="modal-container">
          <h1 className="catch-list-header">Your catches</h1>
          <table className="catch-list-table" cellSpacing={0}>
            <thead>
              <tr className="catch-list-header-row">
                {activePokemonEvolves ? <th>Evolve</th> : null}
                <th>Gen</th>
                <th>Game</th>
                <th>Ball</th>
                <th>Date</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {props.usersPokemon?.length ? (
                renderPokemonRows()
              ) : (
                <tr className={`empty-row drawer-${props.activePokemon?.type1}`}>
                  {activePokemonEvolves ? <td></td> : null}
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  )
}

export default SourcesList

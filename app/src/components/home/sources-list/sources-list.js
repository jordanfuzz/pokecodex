import React, { useState } from 'react'
import Modal from 'react-modal'
import { uniq, uniqBy } from 'ramda'
import Catch from '../catch/catch'
import './sources-list.scss'
import checkIcon from '../../../media/check-icon.svg'

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

  if (!props.activePokemonSources || !props.usersPokemonSources) return null

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleOpenDrawer = async pokemonId => {
    if (openDrawerIndex === pokemonId) setOpenDrawerIndex(null)
    else setOpenDrawerIndex(pokemonId)
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

  const renderSources = () => {
    const uniqueUsersSourceIds = uniq(props.usersPokemonSources.map(x => x.id))
    const unachievedSources = props.activePokemonSources
      .filter(x => !uniqueUsersSourceIds.includes(x.id))
      .map((source, i) => {
        return (
          <span key={i} className="locked-source-pill">
            {source.name}
          </span>
        )
      })

    const achievedSources = uniqBy(source => source.id, props.usersPokemonSources).map(
      (source, i) => (
        <span key={i} className="unlocked-source-pill">
          <img src={checkIcon} className="check-icon" />
          {source.name}
        </span>
      )
    )
    return [achievedSources, unachievedSources]
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
                className="show-catches-button"
                onClick={() => handleNoteClick(pokemon.notes || '')}
              >
                Edit note
              </span>
              <span className="log-catch-button" onClick={() => setDrawerMode('edit')}>
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
              {/* Add hover effect to buttons */}
              {/* Rename class */}
              <span className="show-catches-button" onClick={() => setDrawerMode('log')}>
                Cancel
              </span>
              {/* Rename class */}
              <span
                className="log-catch-button"
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
      return props.usersPokemonSources
        .filter(x => x.pokemonId === pokemon.id)
        .map((source, i) => (
          <span key={i} className="catch-tag">
            {source.name}
          </span>
        ))
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
            <td>{i + 1}</td>
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
            <td>{new Date(pokemon.caughtAt).toLocaleString().replace(',', '')}</td>
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
        <span className="show-catches-button" onClick={handleOpenModal}>
          Show catches
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            className="button-icon"
          />
        </span>
        <span className="log-catch-button" onClick={() => props.setDrawerMode('catch')}>
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
                <th>#</th>
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
                  <td></td>
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

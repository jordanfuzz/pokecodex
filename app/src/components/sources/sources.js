import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SourceEditor from './source-editor/source-editor'
import './sources.scss'

// Manual sources: Non-special variants (unown, minior, etc),
// In-game trades (can have multiple)
// Side games, Special/other

const Sources = () => {
  const [pokemon, setPokemon] = useState([])
  const [activePokemon, setActivePokemon] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [pokemonSources, setPokemonSources] = useState([])
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(async () => {
    const response = await axios.get('/api/all-pokemon')
    setPokemon(response.data.pokemon)
  }, [])

  useEffect(async () => {
    if (!activePokemon) return

    const response = await axios.get(`/api/sources?pokemonId=${activePokemon.id}`)
    setPokemonSources(response.data.sources)
  }, [activePokemon])

  const handleSearch = () => {
    if (!pokemon || isEditMode) return

    const newActivePokemon = pokemon.find(
      mon => mon.name.toLowerCase() === searchText.toLowerCase()
    )
    if (newActivePokemon) {
      setActivePokemon(newActivePokemon)
      setSearchText('')
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && searchText) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleCancel = () => {
    setIsEditMode(false)
  }

  const handleAddSource = async sourceData => {
    if (!sourceData || !activePokemon.id) return
    const response = await axios.post('/api/sources', {
      source: sourceData,
      pokemonId: activePokemon.id,
    })
    setPokemonSources(response.data.sources)
    setIsEditMode(false)
  }

  const renderSourceRows = () => {
    return pokemonSources.map((source, i) => (
      <tr className={`source-data-row hover-${activePokemon.type1}`} key={i}>
        <td>
          {source.image ? <img src={source.image} className="source-image" /> : 'X'}
        </td>
        <td>{source.name}</td>
        <td>{source.source}</td>
        <td>{source.gen}</td>
        <td>{source.description}</td>
      </tr>
    ))
  }

  return (
    <div className="sources-container">
      <div className="pokemon-search-display">
        <h1 className="sources-header">Source editor</h1>
        <div className="active-pokemon-container">
          {activePokemon ? (
            <img src={activePokemon.defaultImage} className="active-pokemon" />
          ) : null}
        </div>
        <input
          className="pokemon-search"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="search-button" onClick={handleSearch}>
          Get
        </button>
      </div>
      <div className="sources-list-container">
        {isEditMode ? (
          <SourceEditor
            handleCancel={handleCancel}
            handleAddSource={handleAddSource}
            pokemonId={activePokemon?.id}
          />
        ) : (
          <>
            <table className="sources-list-table">
              <thead>
                <tr className="sources-header-row">
                  <th>Image</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Gen</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {pokemonSources?.length ? (
                  renderSourceRows()
                ) : (
                  <tr className="empty-row source-data-row">
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
            {activePokemon ? (
              <button onClick={() => setIsEditMode(true)} className="new-source-button">
                Add new
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default Sources

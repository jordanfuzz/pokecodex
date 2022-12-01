import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './sources.scss'

// Manual sources: Non-special variants (unown, minior, etc),
// In-game trades (can have multiple)
// Side games, Special/other

const Sources = () => {
  const [pokemon, setPokemon] = useState([])
  const [activePokemon, setActivePokemon] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [pokemonSources, setPokemonSources] = useState([])
  useEffect(async () => {
    const response = await axios.get('/api/pokemon')
    setPokemon(response.data.pokemon)
  }, [])

  useEffect(async () => {
    if (!activePokemon) return
    console.log('fetching sources')

    const response = await axios.get(
      `/api/sources?pokemonId=${activePokemon.id}`
    )
    setPokemonSources(response.data.sources)
  }, [activePokemon])

  const handleSearch = () => {
    if (!pokemon) return
    console.log('searching!')

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

  const renderSourceRows = () => {
    return pokemonSources.map((source, i) => (
      <tr className={`source-data-row hover-${activePokemon.type1}`} key={i}>
        <td>
          {source.image ? (
            <img src={source.image} className="source-image" />
          ) : (
            'X'
          )}
        </td>
        <td>{source.name}</td>
        <td>{source.source}</td>
        <td>{source.gen}</td>
        <td>{source.description}</td>
      </tr>
    ))
  }

  console.log(pokemonSources)

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
      </div>
    </div>
  )
}

export default Sources

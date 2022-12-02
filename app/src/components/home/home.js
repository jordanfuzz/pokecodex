import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './home.scss'
import typeImages from '../../media/types.js'

const Home = () => {
  const [pokemon, setPokemon] = useState([])
  const [activePokemonSources, setActivePokemonSources] = useState([])
  const [openDrawerIndex, setOpenDrawerIndex] = useState(null)

  useEffect(async () => {
    const response = await axios.get('/api/pokemon')
    setPokemon(response.data.pokemon)
  }, [])

  const handleOpenDrawer = async pokemonId => {
    if (openDrawerIndex === pokemonId) setOpenDrawerIndex(null)
    else {
      setOpenDrawerIndex(pokemonId)
      const pokemonSources = await axios.get(
        `/api/sources?pokemonId=${pokemonId}`
      )
      setActivePokemonSources(pokemonSources.data.sources)
    }
  }

  const renderNoImageSources = () => {
    if (
      !activePokemonSources ||
      activePokemonSources[0]?.pokemonId !== openDrawerIndex
    )
      return

    return activePokemonSources
      .filter(x => !x.image)
      .map(source => {
        return (
          <div>
            <span className="active-source-checkbox">⬜</span>
            <span className="active-source-name">{source.name}</span>
          </div>
        )
      })
  }

  const renderImageSources = () => {
    if (!activePokemonSources) return

    return activePokemonSources
      .filter(x => !!x.image)
      .map(source => {
        return (
          <div>
            <span className="active-source-checkbox">⬜</span>
            <span className="active-source-name">{source.name}</span>
            <img className="active-source-image" src={source.image} />
          </div>
        )
      })
  }

  const renderListRows = () => {
    return pokemon.map((mon, i) => (
      <>
        <tr
          className={`data-row hover-${mon.type1} ${
            openDrawerIndex === mon.id ? `active-${mon.type1}` : ''
          }`}
          key={i}
          onClick={() => handleOpenDrawer(mon.id)}
        >
          <td className="master-checkbox">⬜</td>
          <td className="id-number">{mon.id}</td>
          <td>
            <img src={mon.defaultImage} className="list-icon" />
          </td>
          <td className="name">
            <a className="name-link" href={mon.bulbapediaLink} target="_blank">
              {mon.name}
            </a>
          </td>
          <td className="type">
            <img src={typeImages[mon.type1]} className="type-icon" />
            {mon.type2 ? (
              <img src={typeImages[mon.type2]} className="type-icon" />
            ) : null}
          </td>
        </tr>
        {openDrawerIndex === mon.id ? (
          <tr className={`data-row drawer-${mon.type1}`}>
            <td colspan="5">
              <div className="pokemon-sources-container">
                <span className="no-image-sources">
                  {renderNoImageSources()}
                </span>
                <span className="image-sources">{renderImageSources()}</span>
              </div>
            </td>
          </tr>
        ) : null}
      </>
    ))
  }

  return (
    <div className="home-container">
      <h1 className="list-header">Pokemon List</h1>
      <table className="list-table">
        <thead>
          <tr className="header-row">
            <th>✅</th>
            <th>#</th>
            <th>Icon</th>
            <th>Name</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>{renderListRows()}</tbody>
      </table>
    </div>
  )
}

export default Home

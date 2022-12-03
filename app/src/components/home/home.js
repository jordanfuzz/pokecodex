import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './home.scss'
import typeImages from '../../media/types.js'
import SourcesList from './sources-list/sources-list'
import Catch from './catch/catch'

const Home = () => {
  const [pokemon, setPokemon] = useState([])
  const [activePokemonSources, setActivePokemonSources] = useState([])
  const [openDrawerIndex, setOpenDrawerIndex] = useState(null)
  const [drawerMode, setDrawerMode] = useState('sources')

  useEffect(async () => {
    const response = await axios.get('/api/pokemon')
    setPokemon(response.data.pokemon)
  }, [])

  const handleOpenDrawer = async pokemonId => {
    if (openDrawerIndex === pokemonId) setOpenDrawerIndex(null)
    else {
      setOpenDrawerIndex(pokemonId)
      const pokemonSources = await axios.get(`/api/sources?pokemonId=${pokemonId}`)
      setActivePokemonSources(pokemonSources.data.sources)
    }
    setDrawerMode('sources')
  }

  const renderDrawer = activePokemon => {
    let drawerContents

    switch (drawerMode) {
      case 'sources':
        drawerContents = (
          <SourcesList
            activePokemonSources={activePokemonSources}
            setDrawerMode={setDrawerMode}
          />
        )
        break
      case 'catch':
        drawerContents = <Catch activePokemonSources={activePokemonSources} />
        break
      default:
        drawerContents = null
        break
    }

    return (
      <tr className={`data-row-drawer drawer-${activePokemon.type1}`}>
        <td className="drawer-column" colSpan="5">
          {drawerContents}
        </td>
      </tr>
    )
  }

  const renderListRows = () => {
    return pokemon.map((mon, i) => (
      <React.Fragment key={i}>
        <tr
          className={`data-row hover-${mon.type1} ${
            openDrawerIndex === mon.id ? `active-${mon.type1}` : ''
          }`}
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
            {mon.type2 ? <img src={typeImages[mon.type2]} className="type-icon" /> : null}
          </td>
        </tr>
        {openDrawerIndex === mon.id ? renderDrawer(mon) : null}
      </React.Fragment>
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

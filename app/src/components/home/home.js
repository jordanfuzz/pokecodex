import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, Redirect } from 'react-router-dom'
import './home.scss'
import typeImages from '../../media/types.js'
import SourcesList from './sources-list/sources-list'
import Catch from './catch/catch'
import Rules from '../common/rules/rules'
import Filters from './filters/filters'

const Home = () => {
  const [userData, setUserData] = useState(null)
  const [pokemon, setPokemon] = useState([])
  const [activePokemonSources, setActivePokemonSources] = useState([])
  const [usersPokemon, setUsersPokemon] = useState([])
  const [usersRules, setUsersRules] = useState(null)
  const [catchData, setCatchData] = useState(null)
  const [openDrawerIndex, setOpenDrawerIndex] = useState(null)
  const [drawerMode, setDrawerMode] = useState('sources')
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [filterRange, setFilterRange] = useState(null)
  const [filterComplete, setFilterComplete] = useState(false)
  const [gameVersions, setGameVersions] = useState([])
  const [gameGenForFiltering, setGameGenForFiltering] = useState(null)
  const [limitedDex, setLimitedDex] = useState(null)

  useEffect(async () => {
    try {
      const response = await axios.get('/api/auth/login', {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': true,
        },
      })
      if (response?.data?.id) setUserData(response.data)
      else setShouldRedirect(true)
    } catch (error) {
      setShouldRedirect(true)
    }
  }, [])

  useEffect(async () => {
    if (!userData?.id) return
    refreshPokemonList()
    const rulesResponse = await axios.get(`/api/user/rules?userId=${userData.id}`)
    setUsersRules(rulesResponse.data.rules)
    const gameData = await axios.get('/api/game-data')
    setGameVersions(gameData.data.gameVersions)
  }, [userData])

  useEffect(async () => {
    if (!userData?.id) return
    refreshPokemonList()
  }, [gameGenForFiltering])

  const handleOpenDrawer = async pokemonId => {
    if (openDrawerIndex === pokemonId) setOpenDrawerIndex(null)
    else {
      setOpenDrawerIndex(pokemonId)
      const genIdParameter = gameGenForFiltering
        ? `&generationId=${gameGenForFiltering}`
        : ''
      const usersPokemonData = await axios.get(
        `/api/pokemon?userId=${userData.id}&pokemonId=${pokemonId}${genIdParameter}`
      )
      if (!usersPokemonData.data) return

      setPokemonState(usersPokemonData.data)
    }
    setDrawerMode('sources')
  }

  const setPokemonState = usersPokemonData => {
    const {
      sources,
      usersPokemon,
      usersPokemonSources,
      pokeballs,
      gameVersions,
      usersPokemonEvolutionSources,
    } = usersPokemonData

    setActivePokemonSources(sources)
    setUsersPokemon(usersPokemon)
    setCatchData({
      usersPokemonSources,
      pokeballs,
      gameVersions,
      usersPokemonEvolutionSources,
    })
  }

  const refreshPokemonList = async () => {
    const genIdParameter = gameGenForFiltering
      ? `&generationId=${gameGenForFiltering}`
      : ''
    const newPokemonResults = await axios.get(
      `/api/all-pokemon?userId=${userData?.id}${genIdParameter}`
    )
    setPokemon(newPokemonResults.data.pokemon)
  }

  const handleSubmitNewPokemon = async pokemonData => {
    setDrawerMode('sources')
    const newPokemonData = {
      ...pokemonData,
      userId: userData?.id,
    }

    const usersPokemonData = await axios.post('/api/pokemon', newPokemonData)
    if (!usersPokemonData) return

    setPokemonState(usersPokemonData.data)
    refreshPokemonList()
  }

  const handleUpdatePokemonNote = async noteData => {
    const newNoteData = { ...noteData, userId: userData.id }
    const usersPokemonData = await axios.put('/api/users-pokemon/note', newNoteData)
    if (!usersPokemonData) return

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
  }

  const handleUpdateUsersPokemon = async pokemonData => {
    const newPokemonData = {
      ...pokemonData,
      userId: userData.id,
    }
    const usersPokemonData = await axios.put('/api/users-pokemon', newPokemonData)
    if (!usersPokemonData) return

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
    const newCatchData = Object.assign({}, catchData, {
      usersPokemonSources: usersPokemonData.data?.usersPokemonSources,
    })
    setCatchData(newCatchData)
    refreshPokemonList()
  }

  const handleEvolvePokemon = async (oldPokemonData, evolvedPokemonId) => {
    const newPokemonData = {
      userId: userData.id,
      evolvedPokemonId,
      oldPokemonData,
    }
    const usersPokemonData = await axios.put('/api/users-pokemon/evolve', newPokemonData)
    if (!usersPokemonData) return

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
    const newCatchData = Object.assign({}, catchData, {
      usersPokemonSources: usersPokemonData.data?.usersPokemonSources,
      usersPokemonEvolutionSources: usersPokemonData.data?.usersPokemonEvolutionSources,
    })
    setCatchData(newCatchData)
    refreshPokemonList()
  }

  const handleDeleteUsersPokemon = async pokemonData => {
    const newPokemonData = {
      ...pokemonData,
      userId: userData.id,
    }
    const usersPokemonData = await axios.delete('/api/users-pokemon', {
      data: newPokemonData,
    })
    if (!usersPokemonData) return

    const newCatchData = Object.assign({}, catchData, {
      usersPokemonSources: usersPokemonData.data?.usersPokemonSources,
    })

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
    setCatchData(newCatchData)
    refreshPokemonList()
  }

  const handleUpdateUsersRules = async newRules => {
    const newRulesData = {
      rules: newRules,
      userId: userData.id,
    }
    const usersRulesData = await axios.put('/api/user/rules', newRulesData)
    setUsersRules(usersRulesData.data?.rules)
    refreshPokemonList()
  }

  const addEvolutionsToActivePokemon = activePokemon => {
    if (!pokemon || !activePokemon.evolvesTo) return activePokemon
    const activePokemonWithEvolution = Object.assign({}, activePokemon)
    const evolutions = pokemon.filter(x =>
      activePokemonWithEvolution.evolvesTo.includes(x.id)
    )
    if (evolutions && evolutions.length)
      activePokemonWithEvolution.evolutions = evolutions
    return activePokemonWithEvolution
  }

  const renderDrawer = activePokemon => {
    let drawerContents

    switch (drawerMode) {
      case 'sources':
        drawerContents = (
          <SourcesList
            activePokemonSources={activePokemonSources}
            activePokemon={addEvolutionsToActivePokemon(activePokemon)}
            setDrawerMode={setDrawerMode}
            usersPokemon={usersPokemon}
            catchData={catchData}
            usersPokemonSources={catchData?.usersPokemonSources}
            usersPokemonEvolutionSources={catchData?.usersPokemonEvolutionSources}
            handleUpdatePokemonNote={handleUpdatePokemonNote}
            handleUpdateUsersPokemon={handleUpdateUsersPokemon}
            handleDeleteUsersPokemon={handleDeleteUsersPokemon}
            handleEvolvePokemon={handleEvolvePokemon}
          />
        )
        break
      case 'catch':
        drawerContents = (
          <Catch
            activePokemonSources={activePokemonSources}
            usersPokemon={usersPokemon}
            catchData={catchData}
            activePokemon={activePokemon}
            handleSubmit={handleSubmitNewPokemon}
          />
        )
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
    let pokemonFilteredByGen
    if (limitedDex) {
      pokemonFilteredByGen = pokemon.filter(x => limitedDex.includes(x.id))
    } else {
      pokemonFilteredByGen = filterRange
        ? pokemon.filter(x => x.id >= filterRange[0] && x.id <= filterRange[1])
        : pokemon
    }

    const filteredPokemon = filterComplete
      ? pokemonFilteredByGen.filter(x => !x.isComplete)
      : pokemonFilteredByGen

    return filteredPokemon.map((mon, i) => (
      <React.Fragment key={i}>
        <tr
          className={`data-row hover-${mon.type1} ${
            openDrawerIndex === mon.id ? `active-${mon.type1}` : ''
          }`}
          onClick={() => handleOpenDrawer(mon.id)}
        >
          <td className="master-checkbox">{mon.isComplete ? '✅' : '⬜'}</td>
          <td className="id-number">{mon.id}</td>
          <td>
            <img src={mon.defaultImage} className="list-icon" />
          </td>
          <td className="name">
            <a
              className="name-link"
              href={`${mon.bulbapediaLink}#Game_locations`}
              target="_blank"
            >
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

  return shouldRedirect ? (
    <Redirect to="/login" />
  ) : (
    <div className="home-page">
      <a className="logout" href="/api/auth/logout">
        Logout
      </a>
      <div className="list-container">
        <div className="list-header-container">
          <h1 className="list-header">Pokécodex</h1>
          <div className="list-options-container">
            <Filters
              filterRange={filterRange}
              setFilterRange={setFilterRange}
              filterComplete={filterComplete}
              setFilterComplete={setFilterComplete}
              gameVersions={gameVersions}
              setGameGenForFiltering={setGameGenForFiltering}
              setLimitedDex={setLimitedDex}
            />
            <Link to="/box-view">
              <span className="box-view-link">Box View</span>
            </Link>
          </div>
        </div>
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
      <Rules usersRules={usersRules} updateUsersRules={handleUpdateUsersRules} />
    </div>
  )
}

export default Home

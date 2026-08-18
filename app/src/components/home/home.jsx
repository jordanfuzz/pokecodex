import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Link, Navigate } from 'react-router'
import './home.scss'
import typeImages from '../../media/types'
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
  // Mirrors openDrawerIndex for use inside async handlers, where a captured
  // closure value would go stale if the drawer changes while a request is
  // in flight. Kept in sync everywhere setOpenDrawerIndex is called.
  const openDrawerIndexRef = useRef(null)
  const [drawerMode, setDrawerMode] = useState('sources')
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [filterRange, setFilterRange] = useState(null)
  const [filterComplete, setFilterComplete] = useState(false)
  const [gameVersions, setGameVersions] = useState([])
  const [gameGenForFiltering, setGameGenForFiltering] = useState(null)
  const [limitedDex, setLimitedDex] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/login', {
          withCredentials: true,
        })
        if (response?.data?.id) setUserData(response.data)
        else setShouldRedirect(true)
      } catch (error) {
        setShouldRedirect(true)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const loadUserData = async () => {
      if (!userData?.id) return
      try {
        refreshPokemonList()
        const rulesResponse = await axios.get('/api/user/rules')
        setUsersRules(rulesResponse.data.rules)
        const gameData = await axios.get('/api/game-data')
        setGameVersions(gameData.data.gameVersions)
      } catch (error) {
        console.error('Failed to load user data', error)
      }
    }
    loadUserData()
  }, [userData])

  useEffect(() => {
    if (!userData?.id) return
    refreshPokemonList()
  }, [gameGenForFiltering])

  const handleOpenDrawer = async pokemonId => {
    if (openDrawerIndex === pokemonId) {
      openDrawerIndexRef.current = null
      setOpenDrawerIndex(null)
    } else {
      openDrawerIndexRef.current = pokemonId
      setOpenDrawerIndex(pokemonId)
      const genIdParameter = gameGenForFiltering
        ? `&generationId=${gameGenForFiltering}`
        : ''
      const usersPokemonData = await axios.get(
        `/api/pokemon?pokemonId=${pokemonId}${genIdParameter}`
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
      usersSourceOverrides,
      homeRegionCatchIds,
    } = usersPokemonData

    setActivePokemonSources(sources)
    setUsersPokemon(usersPokemon)
    // Payloads that omit overrides or home-region ids must not wipe them.
    setCatchData(prev => ({
      usersPokemonSources,
      pokeballs,
      gameVersions,
      usersPokemonEvolutionSources,
      usersSourceOverrides: usersSourceOverrides ?? prev?.usersSourceOverrides,
      homeRegionCatchIds: homeRegionCatchIds ?? prev?.homeRegionCatchIds,
    }))
  }

  const handleToggleSourceOverride = async source => {
    const pokemonId = openDrawerIndex
    try {
      const existing = catchData?.usersSourceOverrides?.find(
        x => x.sourceId === source.id
      )
      // Cycle: follow rules -> always required -> never required -> follow rules
      if (!existing) {
        await axios.put('/api/user/source-override', {
          sourceId: source.id,
          isRequired: true,
        })
      } else if (existing.isRequired) {
        await axios.put('/api/user/source-override', {
          sourceId: source.id,
          isRequired: false,
        })
      } else {
        await axios.delete(`/api/user/source-override/${source.id}`)
      }
      // Refresh both the open drawer and the list checkboxes.
      const genIdParameter = gameGenForFiltering
        ? `&generationId=${gameGenForFiltering}`
        : ''
      const usersPokemonData = await axios.get(
        `/api/pokemon?pokemonId=${pokemonId}${genIdParameter}`
      )
      // Guard against a stale response: if the drawer moved on (or closed)
      // while this request was in flight, don't clobber the now-active
      // drawer's state with data for the pokemon that was open when the
      // request started.
      if (usersPokemonData.data && openDrawerIndexRef.current === pokemonId) {
        setPokemonState(usersPokemonData.data)
      }
      refreshPokemonList()
    } catch (error) {
      console.error('Failed to toggle source override', error)
    }
  }

  const refreshPokemonList = async () => {
    const genIdParameter = gameGenForFiltering
      ? `?generationId=${gameGenForFiltering}`
      : ''
    const newPokemonResults = await axios.get(`/api/all-pokemon${genIdParameter}`)
    setPokemon(newPokemonResults.data.pokemon)
  }

  const handleSubmitNewPokemon = async pokemonData => {
    setDrawerMode('sources')
    const newPokemonData = {
      ...pokemonData,
      generationId: gameGenForFiltering,
    }

    const usersPokemonData = await axios.post('/api/pokemon', newPokemonData)
    if (!usersPokemonData) return

    setPokemonState(usersPokemonData.data)
    refreshPokemonList()
  }

  const handleUpdatePokemonNote = async noteData => {
    const usersPokemonData = await axios.put('/api/users-pokemon/note', noteData)
    if (!usersPokemonData) return

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
  }

  const handleUpdateUsersPokemon = async pokemonData => {
    const usersPokemonData = await axios.put('/api/users-pokemon', pokemonData)
    if (!usersPokemonData) return

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
    const newCatchData = Object.assign({}, catchData, {
      usersPokemonSources: usersPokemonData.data?.usersPokemonSources,
      homeRegionCatchIds:
        usersPokemonData.data?.homeRegionCatchIds ?? catchData?.homeRegionCatchIds,
      usersSourceOverrides:
        usersPokemonData.data?.usersSourceOverrides ?? catchData?.usersSourceOverrides,
    })
    setCatchData(newCatchData)
    refreshPokemonList()
  }

  const handleEvolvePokemon = async (oldPokemonData, evolvedPokemonId) => {
    const newPokemonData = {
      evolvedPokemonId,
      oldPokemonData,
    }
    const usersPokemonData = await axios.put('/api/users-pokemon/evolve', newPokemonData)
    if (!usersPokemonData) return

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
    const newCatchData = Object.assign({}, catchData, {
      usersPokemonSources: usersPokemonData.data?.usersPokemonSources,
      usersPokemonEvolutionSources: usersPokemonData.data?.usersPokemonEvolutionSources,
      homeRegionCatchIds:
        usersPokemonData.data?.homeRegionCatchIds ?? catchData?.homeRegionCatchIds,
    })
    setCatchData(newCatchData)
    refreshPokemonList()
  }

  const handleDeleteUsersPokemon = async pokemonData => {
    const usersPokemonData = await axios.delete('/api/users-pokemon', {
      data: pokemonData,
    })
    if (!usersPokemonData) return

    const newCatchData = Object.assign({}, catchData, {
      usersPokemonSources: usersPokemonData.data?.usersPokemonSources,
      homeRegionCatchIds:
        usersPokemonData.data?.homeRegionCatchIds ?? catchData?.homeRegionCatchIds,
    })

    setUsersPokemon(usersPokemonData.data?.usersPokemon)
    setCatchData(newCatchData)
    refreshPokemonList()
  }

  const handleUpdateUsersRules = async newRules => {
    const newRulesData = {
      rules: newRules,
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
            usersSourceOverrides={catchData?.usersSourceOverrides}
            homeRegionCatchIds={catchData?.homeRegionCatchIds}
            handleToggleSourceOverride={handleToggleSourceOverride}
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

    return filteredPokemon.map(mon => (
      <React.Fragment key={mon.id}>
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
    <Navigate to="/login" replace />
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

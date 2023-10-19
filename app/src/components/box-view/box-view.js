import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, Redirect } from 'react-router-dom'
import Box from './box/box'
import BoxChecklist from './box-checklist/box-checklist'
import Rules from '../common/rules/rules'
import './box-view.scss'
import { gameData } from './box-view.logic'

const BoxView = () => {
  const [usersRules, setUsersRules] = useState(null)
  const [userData, setUserData] = useState(null)
  const [pokemon, setPokemon] = useState([])
  const [filteredPokemon, setFilteredPokemon] = useState([])
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(gameData[0][1])
  const [selectedBox, setSelectedBox] = useState(1)

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
  }, [userData])

  useEffect(async () => {
    handleFilterPokemon(pokemon)
  }, [selectedVersion, pokemon])

  const handleUpdateUsersRules = async newRules => {
    const newRulesData = {
      rules: newRules,
      userId: userData.id,
    }
    const usersRulesData = await axios.put('/api/user/rules', newRulesData)
    setUsersRules(usersRulesData.data?.rules)
    refreshPokemonList()
  }

  const refreshPokemonList = async () => {
    const newPokemonResults = await axios.get(`/api/all-pokemon?userId=${userData?.id}`)
    setPokemon(newPokemonResults.data.pokemon)
  }

  const handleFilterPokemon = allPokemon => {
    let filteredPokemon = allPokemon
    if (selectedVersion.dexLimit)
      filteredPokemon = allPokemon.slice(0, selectedVersion.dexLimit)
    else if (selectedVersion.limitedDex)
      filteredPokemon = allPokemon.filter(mon =>
        selectedVersion.limitedDex.includes(mon.id)
      )

    if (selectedVersion.addMeltanLine) {
      const meltan = allPokemon.find(mon => mon.id === 808)
      const melmetal = allPokemon.find(mon => mon.id === 809)
      filteredPokemon = [...filteredPokemon, meltan, melmetal]
    }

    // const shouldAddGenderVariants = !selectedVersion.ignoreGender && userRules.gender
    // const shouldAddRegionVariants = !selectedVersion.ignoreRegionalVariants && userRules.regional

    // temporarily ignore gender and regional variants
    const shouldAddGenderVariants = false
    const shouldAddRegionVariants = false
    const shouldAddFormVariants = usersRules?.variant

    // first, mark isCaught for all pokemon that a user has one of,
    // even if it isn't the right source

    // then worry about refactoring to deal with sources

    const pokemonWithSources = filteredPokemon
      .map(mon => {
        let newEntries = []
        let addedGenderVariant = false
        mon.sources.forEach(source => {
          switch (source) {
            case 'male':
              if (shouldAddGenderVariants) {
                newEntries.push({ ...mon, variant: source })
                addedGenderVariant = true
              }
              return
            case 'female':
              if (shouldAddGenderVariants) {
                newEntries.push({ ...mon, variant: source })
                addedGenderVariant = true
              }
              return
            case 'variant':
              if (shouldAddFormVariants) newEntries.push({ ...mon, variant: source })
              return
            case 'regional':
              if (shouldAddRegionVariants) newEntries.push({ ...mon, variant: source })
              return
            default:
              return
          }
        })
        return addedGenderVariant ? newEntries : [mon, ...newEntries]
      })
      .flat()

    setFilteredPokemon(pokemonWithSources)
  }

  const handleVersionChange = version => {
    const versionData = gameData.find(([key, value]) => key === version)
    setSelectedVersion(versionData[1])
  }

  const handleBoxChange = box => {
    setSelectedBox(box)
  }

  console.log('pokemon', pokemon)

  return shouldRedirect ? (
    <Redirect to="/login" />
  ) : (
    <div className="box-view-page">
      <a className="logout" href="/api/auth/logout">
        Logout
      </a>
      <div className="box-view-container">
        <div className="box-view-header-container">
          <h1 className="box-view-header">Box View</h1>
          <select
            className="filter-dropdown"
            onChange={e => handleVersionChange(e.target.value)}
          >
            {gameData.map(([key, value], i) => (
              <option key={i} value={key}>
                {key}
              </option>
            ))}
          </select>
          <Link to="/">
            <span className="list-view-link">List View</span>
          </Link>
        </div>
        <Box
          pokemon={filteredPokemon}
          selectedVersion={selectedVersion}
          selectedBox={selectedBox}
          handleBoxChange={handleBoxChange}
        />
      </div>
      <BoxChecklist
        filteredPokemon={filteredPokemon}
        selectedVersion={selectedVersion}
        selectedBox={selectedBox}
      />
      <Rules usersRules={usersRules} updateUsersRules={handleUpdateUsersRules} />
    </div>
  )
}

export default BoxView

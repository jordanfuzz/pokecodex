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

    const shouldAddGenderVariants = !selectedVersion.ignoreGender && usersRules.gender
    const shouldAddRegionVariants =
      !selectedVersion.ignoreRegionalVariants && usersRules.regional
    const shouldAddFormVariants = usersRules?.variant

    const pokemonWithSources = filteredPokemon
      .map(mon => {
        let newEntries = []
        let replacedDefault = false
        mon.sources.forEach(source => {
          switch (source) {
            case 'male':
              if (shouldAddGenderVariants) {
                const isCaught =
                  mon.usersSourcesByGen && mon.usersSourcesByGen.male
                    ? mon.usersSourcesByGen.male.some(gen => gen <= selectedVersion.gen)
                    : false
                newEntries.push({
                  ...mon,
                  variant: source,
                  isCaught,
                  image:
                    mon.imagesBySource.find(x => x[0] === 'Male')?.[1] ||
                    mon.defaultImage,
                })
                if (!replacedDefault)
                  replacedDefault = mon.sourcesByType.defaultSource === 'Male'
              }
              return
            case 'female':
              if (shouldAddGenderVariants) {
                const isCaught =
                  mon.usersSourcesByGen && mon.usersSourcesByGen.female
                    ? mon.usersSourcesByGen.female.some(gen => gen <= selectedVersion.gen)
                    : false
                newEntries.push({
                  ...mon,
                  variant: source,
                  isCaught,
                  image:
                    mon.imagesBySource.find(x => x[0] === 'Female')?.[1] ||
                    mon.defaultImage,
                })
                if (!replacedDefault)
                  replacedDefault = mon.sourcesByType.defaultSource === 'Female'
              }
              return
            case 'variant':
              if (shouldAddFormVariants) {
                if (!mon.sourcesByType || !mon.sourcesByType.variant) return
                mon.sourcesByType.variant.forEach(variant => {
                  const userHasVariantSources =
                    mon.usersSourcesByGen && mon.usersSourcesByGen.variant

                  const isCaught =
                    userHasVariantSources &&
                    mon.usersSourcesByGen.variant.some(
                      ([sourceName, gens]) =>
                        sourceName === variant &&
                        gens.some(gen => gen <= selectedVersion.gen)
                    )
                  newEntries.push({
                    ...mon,
                    variant,
                    isCaught,
                    image:
                      mon.imagesBySource.find(x => x[0] === variant)?.[1] ||
                      mon.defaultImage,
                  })
                  if (!replacedDefault)
                    replacedDefault = mon.sourcesByType.defaultSource === variant
                })
              }
              return
            case 'regional':
              if (shouldAddRegionVariants) {
                if (!mon.usersSourcesByGen || !mon.usersSourcesByGen.regional) return
                mon.usersSourcesByGen.regional.forEach(variant => {
                  const [variantName, variantGen] = variant
                  const isCaught = variantGen <= selectedVersion.gen
                  newEntries.push({ ...mon, variant: variantName, isCaught })
                })
              }
              return
            default:
              return
          }
        })

        const isCaught =
          mon.usersSourcesByGen && mon.usersSourcesByGen.all
            ? mon.usersSourcesByGen.all.some(gen => gen <= selectedVersion.gen)
            : false
        return replacedDefault
          ? newEntries
          : [Object.assign({}, mon, { isCaught, image: mon.defaultImage }), ...newEntries]
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

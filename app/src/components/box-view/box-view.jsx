import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, Navigate } from 'react-router'
import Box from './box/box'
import BoxChecklist from './box-checklist/box-checklist'
import './box-view.scss'

const BoxView = () => {
  const [userData, setUserData] = useState(null)
  const [pokemon, setPokemon] = useState([])
  const [usersBoxData, setUsersBoxData] = useState(null)
  const [gameData, setGameData] = useState(null)
  const [filteredPokemon, setFilteredPokemon] = useState([])
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [selectedBox, setSelectedBox] = useState(1)
  const [isChecklistEditMode, setIsChecklistEditMode] = useState(false)
  const [hoveredPokemonIndex, setHoveredPokemonIndex] = useState(null)

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
      refreshPokemonList()
      const boxDataResponse = await axios.get('/api/pokemon/box-data')
      setGameData(boxDataResponse.data.gameVersions)
      if (!boxDataResponse.data.usersBoxData || !boxDataResponse.data.usersBoxData.length) {
        const newUserBoxData = await axios.post('/api/pokemon/box-data/setup')
        setUsersBoxData(newUserBoxData.data.usersBoxData)
      } else setUsersBoxData(boxDataResponse.data.usersBoxData)
    }
    loadUserData()
  }, [userData])

  useEffect(() => {
    if (selectedVersion) handleFilterPokemon(pokemon)
  }, [selectedVersion, pokemon])

  useEffect(() => {
    setSelectedVersion(gameData?.[0]?.[1])
  }, [gameData])

  const handleUpdateUsersBoxData = async completeRecords => {
    const newUsersBoxData = {
      completeRecords,
      gameId: selectedVersion.id,
    }
    const updatedUsersBoxData = await axios.put('/api/pokemon/box-data', newUsersBoxData)
    setUsersBoxData(updatedUsersBoxData.data?.usersBoxData)
  }

  const refreshPokemonList = async () => {
    const newPokemonResults = await axios.get('/api/all-pokemon')
    setPokemon(newPokemonResults.data.pokemon)
  }

  // Gens 1-2 and 3+ have no transfer path between them.
  const transferPathOk = (catchGen, versionGen) =>
    catchGen <= versionGen && !(catchGen <= 2 && versionGen >= 3)

  const handleFilterPokemon = allPokemon => {
    let filteredPokemon = allPokemon
    if (selectedVersion.dexLimit)
      filteredPokemon = allPokemon.slice(0, selectedVersion.dexLimit)
    else if (selectedVersion.limitedDex)
      filteredPokemon = allPokemon.filter(mon => selectedVersion.limitedDex.includes(mon.id))

    if (selectedVersion.addMeltanLine) {
      const meltan = allPokemon.find(mon => mon.id === 808)
      const melmetal = allPokemon.find(mon => mon.id === 809)
      filteredPokemon = [...filteredPokemon, meltan, melmetal]
    }

    const versionGen = selectedVersion.generationId

    const entryMakesBoxRow = entry => {
      if (entry.type === 'male' || entry.type === 'female')
        return !selectedVersion.ignoreGender
      if (entry.type === 'regional') return !selectedVersion.ignoreRegionalVariants
      if (entry.type === 'variant') return true
      // Non-standard types only appear as box rows when the user forced them.
      return entry.isOverridden
    }

    const pokemonWithSources = filteredPokemon
      .map(mon => {
        let replacedDefault = false
        const newEntries = (mon.requiredSources || [])
          .filter(entryMakesBoxRow)
          .filter(entry => entry.firstGen === 0 || entry.firstGen <= versionGen)
          .map(entry => {
            if (entry.replaceDefault) replacedDefault = true
            return {
              ...mon,
              variant: entry.name,
              recordKey: `${mon.id}:${entry.sourceId}`,
              isCaught: entry.caughtInGens.some(gen => transferPathOk(gen, versionGen)),
              image:
                mon.imagesBySource.find(x => x[0] === entry.name)?.[1] || mon.defaultImage,
            }
          })

        const isCaught =
          mon.usersSourcesByGen && mon.usersSourcesByGen.all
            ? mon.usersSourcesByGen.all.some(gen => transferPathOk(gen, versionGen))
            : false
        const baseEntry = Object.assign({}, mon, {
          isCaught,
          recordKey: `${mon.id}`,
          image: mon.defaultImage,
        })
        return replacedDefault ? newEntries : [baseEntry, ...newEntries]
      })
      .flat()

    setFilteredPokemon(pokemonWithSources)
  }

  const handleVersionChange = version => {
    const versionData = gameData.find(([key]) => key === version)
    setSelectedVersion(versionData[1])
    setSelectedBox(1)
  }

  const handleBoxChange = box => {
    setSelectedBox(box)
  }

  if (shouldRedirect) return <Navigate to="/login" replace />
  if (!gameData || !selectedVersion) return null

  return (
    <div className="box-view-page">
      <a className="logout" href="/api/auth/logout">
        Logout
      </a>
      <div className="box-view-container">
        <div className="box-view-header-container">
          <h1 className="box-view-header">Box View</h1>
          <select
            className="filter-dropdown"
            value={gameData.find(([, v]) => v === selectedVersion)?.[0] ?? ''}
            onChange={e => handleVersionChange(e.target.value)}
            disabled={isChecklistEditMode}
          >
            {gameData.map(([key], i) => (
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
          isChecklistEditMode={isChecklistEditMode}
          usersBoxData={usersBoxData}
          hoveredPokemonIndex={hoveredPokemonIndex}
        />
      </div>
      <BoxChecklist
        filteredPokemon={filteredPokemon}
        selectedVersion={selectedVersion}
        selectedBox={selectedBox}
        usersBoxData={usersBoxData}
        isEditMode={isChecklistEditMode}
        setIsEditMode={setIsChecklistEditMode}
        handleUpdateUsersBoxData={handleUpdateUsersBoxData}
        setHoveredPokemonIndex={setHoveredPokemonIndex}
      />
    </div>
  )
}

export default BoxView

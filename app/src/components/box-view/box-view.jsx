import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, Navigate } from 'react-router'
import Box from './box/box'
import BoxChecklist from './box-checklist/box-checklist'
import { filterPokemonForVersion } from './box-view.logic'
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
      try {
        refreshPokemonList()
        const boxDataResponse = await axios.get('/api/pokemon/box-data')
        setGameData(boxDataResponse.data.gameVersions)
        if (
          !boxDataResponse.data.usersBoxData ||
          !boxDataResponse.data.usersBoxData.length
        ) {
          const newUserBoxData = await axios.post('/api/pokemon/box-data/setup')
          setUsersBoxData(newUserBoxData.data.usersBoxData)
        } else setUsersBoxData(boxDataResponse.data.usersBoxData)
      } catch (error) {
        console.error('Failed to load data', error)
      }
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

  const handleFilterPokemon = allPokemon => {
    setFilteredPokemon(filterPokemonForVersion(allPokemon, selectedVersion))
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

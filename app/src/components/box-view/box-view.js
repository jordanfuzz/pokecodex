import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Link, Redirect } from 'react-router-dom'
import Rules from '../common/rules/rules'
import './box-view.scss'
import { gameData } from './box-view.logic'
import Box from './box/box'

const BoxView = () => {
  const [usersRules, setUsersRules] = useState(null)
  const [userData, setUserData] = useState(null)
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
    const rulesResponse = await axios.get(`/api/user/rules?userId=${userData.id}`)
    setUsersRules(rulesResponse.data.rules)
  }, [userData])

  const handleUpdateUsersRules = async newRules => {
    const newRulesData = {
      rules: newRules,
      userId: userData.id,
    }
    const usersRulesData = await axios.put('/api/user/rules', newRulesData)
    setUsersRules(usersRulesData.data?.rules)
    // refreshPokemonList()
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
          selectedVersion={selectedVersion}
          selectedBox={selectedBox}
          handleBoxChange={handleBoxChange}
        />
      </div>
      <Rules usersRules={usersRules} updateUsersRules={handleUpdateUsersRules} />
    </div>
  )
}

export default BoxView

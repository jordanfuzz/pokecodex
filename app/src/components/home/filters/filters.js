import React, { useState } from 'react'
import './filters.scss'

const filterRangesByGen = {
  gen1: [1, 151],
  gen2: [152, 251],
  gen3: [252, 386],
  gen4: [387, 493],
  gen5: [494, 649],
  gen6: [650, 721],
  gen7: [722, 809],
  gen8: [810, 905],
  gen9: [906, 1010],
}

const Filters = ({
  setFilterRange,
  filterComplete,
  setFilterComplete,
  gameVersions,
  setGameGenForFiltering,
  setLimitedDex,
}) => {
  const [selectedGen, setSelectedGen] = useState('')
  const [selectedGame, setSelectedGame] = useState('')

  const handleGenFilterChange = value => {
    if (value === '') {
      setSelectedGen('')
      setFilterRange(null)
      return
    }
    setSelectedGen(value)
    setFilterRange(filterRangesByGen[value])
    setSelectedGame('')
    setGameGenForFiltering(null)
    setLimitedDex(null)
  }

  const handleGameFilterChange = version => {
    if (version === '') {
      setSelectedGame('')
      setFilterRange(null)
      setGameGenForFiltering(null)
      return
    }

    const versionData = gameVersions.find(([key, value]) => key === version)
    if (!versionData || !versionData[1]) return

    const { limitedDex, generationId, dexLimit } = versionData[1]

    if (limitedDex) {
      setGameGenForFiltering(generationId)
      setFilterRange(null)
      setLimitedDex(limitedDex)
    } else {
      setGameGenForFiltering(generationId)
      setFilterRange([1, dexLimit])
      setLimitedDex(null)
    }
    setSelectedGame(version)
    setSelectedGen('')
  }

  return (
    <div className="filters-container">
      <select
        className="filter-dropdown"
        value={selectedGen}
        onChange={e => handleGenFilterChange(e.target.value)}
      >
        <option value={''}>All gens</option>
        <option value="gen1">Gen 1</option>
        <option value="gen2">Gen 2</option>
        <option value="gen3">Gen 3</option>
        <option value="gen4">Gen 4</option>
        <option value="gen5">Gen 5</option>
        <option value="gen6">Gen 6</option>
        <option value="gen7">Gen 7</option>
        <option value="gen8">Gen 8</option>
        <option value="gen9">Gen 9</option>
      </select>
      <select
        className="filter-dropdown"
        value={selectedGame}
        onChange={e => handleGameFilterChange(e.target.value)}
      >
        <option value={''}>All games</option>
        {gameVersions?.map(([key, value], i) => (
          <option key={i} value={key}>
            {key}
          </option>
        ))}
      </select>
      <input
        type="checkbox"
        checked={filterComplete}
        onChange={() => setFilterComplete(!filterComplete)}
      />
      <label className="filter-checkbox-text">Hide completed</label>
    </div>
  )
}

export default Filters

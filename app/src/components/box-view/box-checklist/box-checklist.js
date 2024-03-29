import React, { useState, useEffect } from 'react'
import './box-checklist.scss'

import pokeball from '../../../media/pokeball.png'

const BoxChecklist = ({
  filteredPokemon,
  selectedVersion,
  selectedBox,
  usersBoxData,
  isEditMode,
  setIsEditMode,
  handleUpdateUsersBoxData,
  setHoveredPokemonIndex,
}) => {
  const [completeRecords, setCompleteRecords] = useState([])

  // TODO: This is duplicated between box and box-checklist. Refactor to be in one place.
  useEffect(() => {
    if (!usersBoxData) return

    const boxDataForVersion = usersBoxData.find(
      gameVersion => gameVersion.gameId === selectedVersion.id
    )
    setCompleteRecords(boxDataForVersion.completeRecords)
  }, [usersBoxData, selectedVersion])

  const handleRecordChange = (checked, mon) => {
    let newCompleteRecords = [...completeRecords]
    if (checked) {
      if (mon.variant) {
        const foundMon = newCompleteRecords.some(
          record => record === `${mon.id}:${mon.variant}`
        )
        if (!foundMon) newCompleteRecords.push(`${mon.id}:${mon.variant}`)
      } else {
        const foundMon = newCompleteRecords.some(record => record === mon.id)
        if (!foundMon) newCompleteRecords.push(mon.id)
      }
    } else {
      if (mon.variant) {
        const foundMon = newCompleteRecords.findIndex(
          record => record === `${mon.id}:${mon.variant}`
        )
        if (foundMon > -1) newCompleteRecords.splice(foundMon, 1)
      } else {
        const foundMon = newCompleteRecords.findIndex(record => record === mon.id)
        if (foundMon > -1) newCompleteRecords.splice(foundMon, 1)
      }
    }
    setCompleteRecords(newCompleteRecords)
  }

  const handleButtonClick = () => {
    if (isEditMode) handleChecklistSave()
    setIsEditMode(!isEditMode)
  }

  const handleChecklistSave = () => {
    handleUpdateUsersBoxData(completeRecords)
  }

  const renderListRows = () => {
    const firstSlot = (selectedBox - 1) * selectedVersion.boxSize
    const lastSlot = firstSlot + selectedVersion.boxSize
    return filteredPokemon.slice(firstSlot, lastSlot).map((pokemon, i) => {
      return (
        <tr
          className={`checklist-row hover-${pokemon.type1}`}
          key={i}
          onMouseEnter={() => setHoveredPokemonIndex(i)}
          onMouseLeave={() => setHoveredPokemonIndex(null)}
        >
          <td className="checklist-slot">{i + 1}</td>
          <td className="checklist-id">{pokemon.id}</td>
          <td className="checklist-name">{pokemon.name}</td>
          <td className="checklist-checkbox">{pokemon.isCaught ? '✅' : '⬜'}</td>
          {isEditMode ? (
            <td className="checklist-checkbox">
              <input
                type="checkbox"
                onChange={e => handleRecordChange(e.target.checked, pokemon)}
                disabled={!pokemon.isCaught}
                checked={
                  pokemon.isCaught && pokemon.variant
                    ? completeRecords.includes(`${pokemon.id}:${pokemon.variant}`)
                    : completeRecords.includes(pokemon.id)
                }
              />
            </td>
          ) : pokemon.variant ? (
            <td className="checklist-checkbox">
              {pokemon.isCaught &&
              completeRecords.includes(`${pokemon.id}:${pokemon.variant}`)
                ? '✅'
                : '⬜'}
            </td>
          ) : (
            <td className="checklist-checkbox">
              {pokemon.isCaught && completeRecords.includes(pokemon.id) ? '✅' : '⬜'}
            </td>
          )}

          <td className="checklist-variant">
            {pokemon.variant ? pokemon.variant : ' - '}
          </td>
        </tr>
      )
    })
  }

  return (
    <div className="checklist-container">
      <table className="checklist-table">
        <thead>
          <tr className="checklist-header-row">
            <th className="checklist-slot">Slot</th>
            <th className="checklist-id">ID</th>
            <th className="checklist-name">Name</th>
            <th>
              <img className="header-row-pokeball" src={pokeball} />
            </th>
            <th>In box</th>
            <th>Variant</th>
          </tr>
        </thead>
        <tbody>{renderListRows()}</tbody>
      </table>
      <button className="edit-checklist-button" onClick={handleButtonClick}>
        {isEditMode ? 'Save' : 'Edit'}
      </button>
    </div>
  )
}

export default BoxChecklist

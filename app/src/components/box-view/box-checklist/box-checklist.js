import React, { useState } from 'react'
import './box-checklist.scss'

import pokeball from '../../../media/pokeball.png'

const BoxChecklist = ({ filteredPokemon, selectedVersion, selectedBox }) => {
  const renderListRows = () => {
    const firstSlot = (selectedBox - 1) * selectedVersion.boxSize
    const lastSlot = firstSlot + selectedVersion.boxSize
    return filteredPokemon.slice(firstSlot, lastSlot).map((pokemon, i) => {
      return (
        <tr className={`checklist-row hover-${pokemon.type1}`} key={i}>
          {/* <td className="checklist-slot">{i + 1}</td> */}
          {/* TODO: What should this be? ID or Slot or count? */}
          <td className="checklist-slot">{pokemon.id}</td>
          <td className="checklist-name">{pokemon.name}</td>
          <td className="checklist-caught">✅</td>
          <td className="checklist-in-box">✅</td>
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
    </div>
  )
}

export default BoxChecklist

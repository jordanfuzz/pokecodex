import React from 'react'
import Select from 'react-select'
import { multiSelectStyles } from './catch.logic'
import './catch.scss'

const Catch = props => {
  if (!props.activePokemonSources) return

  const sourceOptions = props.activePokemonSources.map(x => {
    const label = x.image ? (
      <span className="option-container">
        <img src={x.image} className="option-image" />
        {x.name}
      </span>
    ) : (
      x.name
    )

    return { value: x.id, label }
  })

  return (
    <div className="catch-mode-container">
      <div className="dropdown-container">
        <div className="main-dropdown">
          <Select options={sourceOptions} styles={multiSelectStyles} isMulti={true} />
        </div>
      </div>
      <div className="catch-confirm-button">Log catch</div>
    </div>
  )
}

export default Catch

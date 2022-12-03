import React from 'react'
import './sources-list.scss'

const SourcesList = props => {
  const renderSources = () => {
    return props.activePokemonSources.map((source, i) => {
      return (
        <span key={i} className="locked-source-pill">
          {source.name}
        </span>
      )
    })
  }

  return (
    <>
      <div className="pokemon-sources-container">{renderSources()}</div>
      <div className="drawer-button-container">
        <span className="show-catches-button">
          Show catches
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            className="button-icon"
          />
        </span>
        <span className="log-catch-button" onClick={() => props.setDrawerMode('catch')}>
          Log new catch
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rule-book.png"
            className="button-icon"
          />
        </span>
      </div>
    </>
  )
}

export default SourcesList

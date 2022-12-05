import React from 'react'
import './sources-list.scss'
import checkIcon from '../../../media/check-icon.svg'

const SourcesList = props => {
  if (!props.activePokemonSources) return null
  const renderSources = () => {
    const unachievedSources = props.activePokemonSources
      .filter(x => !props.usersPokemonSources?.map(x => x.id).includes(x.id))
      .map((source, i) => {
        return (
          <span key={i} className="locked-source-pill">
            {source.name}
          </span>
        )
      })
    const achievedSources = props.usersPokemonSources?.map((source, i) => {
      return (
        <span key={i} className="unlocked-source-pill">
          <img src={checkIcon} className="check-icon" />
          {source.name}
        </span>
      )
    })
    return [achievedSources, unachievedSources]
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

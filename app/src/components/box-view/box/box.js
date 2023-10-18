import React, { useState } from 'react'
import { wallpapers } from '../box-view.logic'
import './box.scss'

import boxArrowLeft from '../../../media/box-arrow-left.png'
import boxArrowRight from '../../../media/box-arrow-right.png'

const Box = ({ pokemon, selectedVersion, selectedBox, handleBoxChange }) => {
  const handleArrowClick = direction => {
    if (direction === 'left') {
      if (selectedBox === 1) return handleBoxChange(selectedVersion.maxBoxes)
      handleBoxChange(selectedBox - 1)
    } else {
      if (selectedBox === selectedVersion.maxBoxes) return handleBoxChange(1)
      handleBoxChange(selectedBox + 1)
    }
  }

  const getWallpaper = () => {
    let wallpaperIndex = selectedBox
    if (selectedBox > 32) wallpaperIndex -= 32
    if (selectedVersion.boxSize === 20) return wallpapers[wallpaperIndex]
    if (selectedVersion.boxSize === 30) return wallpapers[wallpaperIndex - 1]

    // if (selectedVersion.boxSize === 60) return largeWallpapers[selectedBox - 1]
  }

  const renderPokemon = () => {
    const firstSlot = (selectedBox - 1) * selectedVersion.boxSize
    const lastSlot = firstSlot + selectedVersion.boxSize
    const boxSize = selectedVersion.boxSize === 20 ? 'small' : 'large'
    return (
      <div className={`box-flex-container-${boxSize}`}>
        {pokemon.slice(firstSlot, lastSlot).map((mon, i) => {
          return (
            <div key={i} className={`box-pokemon-${boxSize}`}>
              <img src={mon.defaultImage} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="box-container">
      <div className="box">
        <img className="box-image" src={getWallpaper()} />
        {renderPokemon()}
      </div>
      <div className="box-footer">
        <img src={boxArrowLeft} onClick={() => handleArrowClick('left')} />
        <span className="box-number">{`Box ${selectedBox}`}</span>
        <img src={boxArrowRight} onClick={() => handleArrowClick('right')} />
      </div>
    </div>
  )
}

export default Box

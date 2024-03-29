import React, { useState, useEffect } from 'react'
import { wallpapers, largeWallpaper } from '../box-view.logic'
import './box.scss'

import boxArrowLeft from '../../../media/box-arrow-left.png'
import boxArrowRight from '../../../media/box-arrow-right.png'

const Box = ({
  pokemon,
  selectedVersion,
  selectedBox,
  handleBoxChange,
  isChecklistEditMode,
  usersBoxData,
  hoveredPokemonIndex,
}) => {
  const [completeRecords, setCompleteRecords] = useState([])

  const handleArrowClick = direction => {
    if (isChecklistEditMode) return

    if (direction === 'left') {
      if (selectedBox === 1) return handleBoxChange(selectedVersion.maxBoxes)
      handleBoxChange(selectedBox - 1)
    } else {
      if (selectedBox === selectedVersion.maxBoxes) return handleBoxChange(1)
      handleBoxChange(selectedBox + 1)
    }
  }

  // TODO: This is duplicated between box and box-checklist. Refactor to be in one place.
  useEffect(() => {
    if (!usersBoxData) return

    const boxDataForVersion = usersBoxData.find(
      gameVersion => gameVersion.gameId === selectedVersion.id
    )
    setCompleteRecords(boxDataForVersion.completeRecords)
  }, [usersBoxData, selectedVersion])

  const getWallpaper = () => {
    let wallpaperIndex = selectedBox
    if (selectedBox > 32) wallpaperIndex -= 32
    if (selectedVersion.boxSize === 20) return wallpapers[wallpaperIndex]
    if (selectedVersion.boxSize === 30) return wallpapers[wallpaperIndex - 1]
    if (selectedVersion.boxSize === 60) return largeWallpaper
  }

  const renderPokemon = () => {
    const firstSlot = (selectedBox - 1) * selectedVersion.boxSize
    const lastSlot = firstSlot + selectedVersion.boxSize
    let boxSize = 'small'
    if (selectedVersion.boxSize === 30) boxSize = 'medium'
    else if (selectedVersion.boxSize === 60) boxSize = 'large'
    return (
      <div className={`box-flex-container-${boxSize}`}>
        {pokemon.slice(firstSlot, lastSlot).map((mon, i) => {
          const recordIsCompleteInBox = mon.variant
            ? completeRecords.includes(`${mon.id}:${mon.variant}`)
            : completeRecords.includes(mon.id)
          const transparent = recordIsCompleteInBox ? '' : 'transparent'
          const hovered = hoveredPokemonIndex === i ? 'hovered' : ''
          return (
            <div key={i} className={`box-pokemon-${boxSize} ${hovered}`}>
              <img className={transparent} src={mon.image} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="box-container">
      <div className="box">
        {selectedVersion.boxSize === 60 ? (
          <img className="large-box-image" src={largeWallpaper} />
        ) : (
          <img className="box-image" src={getWallpaper()} />
        )}
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

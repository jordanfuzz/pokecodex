import React, { useState } from 'react'
import { wallpapers } from '../box-view.logic'
import './box.scss'

import boxArrowLeft from '../../../media/box-arrow-left.png'
import boxArrowRight from '../../../media/box-arrow-right.png'

const Box = ({ selectedVersion, selectedBox, handleBoxChange }) => {
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

  return (
    <div className="box-container">
      <div className="box">
        <img className="box-image" src={getWallpaper()} />
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

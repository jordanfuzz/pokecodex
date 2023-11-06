import React, { useState } from 'react'
import './source-editor.scss'

const SourceEditor = props => {
  const [nameText, setNameText] = useState('')
  const [sourceType, setSourceType] = useState('variant')
  const [sourceGen, setSourceGen] = useState(0)
  const [imageText, setImageText] = useState('')
  const [descriptionText, setDescriptionText] = useState('')
  const [replaceDefault, setReplaceDefault] = useState(false)

  const handleSubmit = () => {
    if (!nameText || !props.pokemonId) return

    const source = {
      name: nameText,
      source: sourceType,
      gen: sourceGen,
      image: imageText || null,
      description: descriptionText || null,
      replaceDefault,
    }

    props.handleAddSource(source)
  }

  return (
    <div className="source-editor-container">
      <div>
        <div className="editor-container">
          <span className="editor-label">Name</span>
          <input
            className="editor-input"
            value={nameText}
            onChange={e => setNameText(e.target.value)}
          />
        </div>
        <div className="editor-container">
          <span className="editor-label">Type</span>
          <select
            className="editor-dropdown"
            value={sourceType}
            onChange={e => setSourceType(e.target.value)}
          >
            <option value="variant">Variant</option>
            <option value="npc-trade">NPC Trade</option>
            <option value="side-game">Side game</option>
            <option value="special">Special</option>
            <option value="regional">Regional</option>
            <option value="prize">Prize</option>
            <option value="gift">Gift</option>
            <option value="pokewalker">Pokewalker</option>
          </select>
        </div>
        <div className="editor-container">
          <span className="editor-label">Gen</span>
          <select
            className="editor-dropdown"
            value={sourceGen}
            onChange={e => setSourceGen(e.target.value)}
          >
            <option value={0}>All</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
            <option value={6}>6</option>
            <option value={7}>7</option>
            <option value={8}>8</option>
          </select>
        </div>
        <div className="editor-container">
          <span className="editor-label">Image</span>
          <input
            className="editor-input"
            value={imageText}
            onChange={e => setImageText(e.target.value)}
          />
        </div>
        <div className="editor-container">
          <input
            className="editor-checkbox"
            type="checkbox"
            checked={replaceDefault}
            onChange={e => setReplaceDefault(e.target.checked)}
          />
          <span className="editor-checkbox-label">Replace default</span>
        </div>
        <div className="description-editor-container">
          <span className="description-editor-label">Description</span>
          <textarea
            className="editor-description-field"
            value={descriptionText}
            onChange={e => setDescriptionText(e.target.value)}
          />
        </div>
      </div>
      <div className="image-preview-container">
        {imageText ? <img src={imageText} className="image-preview" /> : null}
      </div>
      <button className="editor-button" onClick={handleSubmit}>
        Add
      </button>
      <button className="editor-button" onClick={props.handleCancel}>
        Cancel
      </button>
    </div>
  )
}

export default SourceEditor

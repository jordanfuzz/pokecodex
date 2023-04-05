import React, { useState, useEffect } from 'react'
import './rules.scss'

const Rules = ({ usersRules, updateUsersRules }) => {
  const [isEditMode, setIsEditMode] = useState(false)
  const [ruleState, setRuleState] = useState(null)

  useEffect(() => {
    if (!usersRules)
      setRuleState({
        gender: false,
        'npc-trade': false,
        'side-game': false,
        regional: false,
        variant: false,
        special: false,
        original: false,
        shiny: false,
      })
    else setRuleState(usersRules)
  }, [usersRules])

  const handleEditButtonClick = () => {
    if (isEditMode) updateUsersRules(ruleState)
    setIsEditMode(!isEditMode)
  }

  const handleRuleCheck = e => {
    const newRules = Object.assign({}, ruleState, {
      [e.target.value]: e.target.checked,
    })
    setRuleState(newRules)
  }

  return (
    <div className="rules-container">
      <h1 className="rules-list-header">User rules</h1>
      <button className="edit-rules-button" onClick={handleEditButtonClick}>
        {isEditMode ? 'Save' : 'Edit'}
      </button>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="gender"
          value="gender"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['gender']}
        />
        <label className="rule-label" htmlFor="gender">
          Gender differences
        </label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="npc-trade"
          value="npc-trade"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['npc-trade']}
        />
        <label htmlFor="npc-trade">In-game trades</label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="side-game"
          value="side-game"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['side-game']}
        />
        <label htmlFor="side-game">Trades from side games</label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="regional"
          value="regional"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['regional']}
        />
        <label htmlFor="regional">Regional forms</label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="variant"
          value="variant"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['variant']}
        />
        <label htmlFor="variant">Variant forms</label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="special"
          value="special"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['special']}
        />
        <label htmlFor="special">Unique sources</label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="original"
          value="original"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['original']}
        />
        <label htmlFor="original">From original region</label>
      </div>
      <div className="single-rule">
        <input
          disabled={!isEditMode}
          type="checkbox"
          id="shiny"
          value="shiny"
          onChange={e => handleRuleCheck(e)}
          defaultChecked={ruleState && ruleState['shiny']}
        />
        <label htmlFor="shiny">Shiny</label>
      </div>
    </div>
  )
}

export default Rules

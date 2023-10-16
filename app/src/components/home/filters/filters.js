import React from 'react'
import './filters.scss'

const Filters = ({ filterRange, setFilterRange, filterComplete, setFilterComplete }) => {
  return (
    <div className="filters-container">
      <select
        className="filter-dropdown"
        value={filterRange}
        onChange={e => setFilterRange(e.target.value)}
      >
        <option value={''}>All gens</option>
        <option value="1,151">1</option>
        <option value="152,251">2</option>
        <option value="252,386">3</option>
        <option value="387,494">4</option>
        <option value="495,649">5</option>
        <option value="650,721">6</option>
        <option value="722,809">7</option>
        <option value="810,898">8</option>
      </select>
      <input
        type="checkbox"
        checked={filterComplete}
        onChange={() => setFilterComplete(!filterComplete)}
      />
      <label className="filter-checkbox-text">Hide completed</label>
    </div>
  )
}

export default Filters

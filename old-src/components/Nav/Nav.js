import React, {Component} from 'react'
import './Nav.css'
import pokeball from './pokeball.png'
import threeballs from './threeballs.svg'
import switchTeam from './switch.svg'
import {Link} from 'react-router-dom'

export default class Nav extends Component {

  render() {
    return (
      <div className="nav-container">
        <ul className="nav-list">
          <Link className="no-underline" to="/">
            <li className="list-item">
              <img alt="Pokeball" className="menu-button finder" src={pokeball}/>
              <span className="menu-text">Finder</span>
            </li>
          </Link>
          <Link className="no-underline" to="/picker">
            <li className="list-item"><img alt="Pokeball" className="menu-button picker" src={switchTeam}/>
            <span className="menu-text">Picker</span>
          </li></Link>
          <Link className="no-underline" to="/team">
            <li className="list-item"><img alt="Pokeball" className="menu-button team" src={threeballs}/>
            <span className="menu-text">Team</span>
          </li></Link>
        </ul>
      </div>
    )
  }
}
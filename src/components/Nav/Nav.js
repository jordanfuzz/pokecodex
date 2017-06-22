import React, {Component} from 'react'
import './Nav.css'
import pokeball from './pokeball.png'

export default class Nav extends Component {

  render() {
    return (
      <div className="nav-container">
        <ul className="nav-list">
          <li><img alt="Pokeball" className="menu-button" src={pokeball}/></li>
          <li><img alt="Pokeball" className="menu-button" src={pokeball}/></li>
          <li><img alt="Pokeball" className="menu-button" src={pokeball}/></li>
        </ul>
      </div>
    )
  }
}
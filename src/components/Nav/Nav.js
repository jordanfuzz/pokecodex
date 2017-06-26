import React, {Component} from 'react'
import './Nav.css'
import pokeball from './pokeball.png'
import {Link} from 'react-router-dom'

export default class Nav extends Component {

  render() {
    return (
      <div className="nav-container">
        <ul className="nav-list">
          <Link to="/"><li><img alt="Pokeball" className="menu-button" src={pokeball}/></li></Link>
          <Link to="/picker"><li><img alt="Pokeball" className="menu-button" src={pokeball}/></li></Link>
          <Link to="/team"><li><img alt="Pokeball" className="menu-button" src={pokeball}/></li></Link>
        </ul>
      </div>
    )
  }
}
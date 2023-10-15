import React, { useEffect, useState } from 'react'
import { Redirect } from 'react-router-dom'
import axios from 'axios'
import './login.scss'

import pikaWalk from '../../media/slow-walk-with-pika.gif'

const Login = () => {
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    axios
      .get('/api/auth/login', {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': true,
        },
      })
      .then(res => {
        if (res.data?.id) setUserData(res.data)
      })
  }, [])

  const isLoggedIn = userData?.id

  return isLoggedIn ? (
    <Redirect to="/" replace />
  ) : (
    <div className="login-page">
      <div className="login-container">
        <h1 className="login-header">Pokecodex</h1>
        <span className="login-subtitle">A comprehensive catch-em-all tracker.</span>
        <img src={pikaWalk} className="login-image" />
        <a href="/api/auth">
          <button className="login-button">Login with Discord</button>
        </a>
      </div>
    </div>
  )
}

export default Login

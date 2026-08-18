import Modal from 'react-modal'
import { Routes, Route } from 'react-router'
import Home from './components/home/home'
import BoxView from './components/box-view/box-view'
import Login from './components/login/login'
import Sources from './components/sources/sources'
import './app.scss'

Modal.setAppElement('#app')

const App = () => {
  return (
    <div className="background">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/box-view" element={<BoxView />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sources" element={<Sources />} />
      </Routes>
    </div>
  )
}

export default App

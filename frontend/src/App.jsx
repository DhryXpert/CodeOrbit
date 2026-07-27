import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import './styles/index.css'

const SignUp = lazy(() => import('./pages/SignUp'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="dashboard-loading">Loading CodeOrbit...</div>}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

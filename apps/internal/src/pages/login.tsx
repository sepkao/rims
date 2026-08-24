import {useEffect,useState, type FormEvent} from 'react'
import {useAuth} from '../contexts/AuthContext.tsx'
import {useNavigate} from 'react-router-dom'

export default function Login() {
    const { role, loading, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    async function handleSubmit(e:FormEvent) {
        e.preventDefault()
        const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.role) {
        login(data.role)
    }
}
    useEffect(() => {
        if (!loading && role==="owner") {
            navigate(`/owner/dashboard`,{ replace: true});
        }
        if (!loading && role==="staff") {
            navigate(`/staff/orders`,{ replace: true});
        }
        if (!loading && role==="cashier") {
            navigate(`/cashier/tables`,{ replace: true});
        }
    }, [role, loading, navigate])

    if (loading) return <p>Loading...</p>

    return <div>
    <form onSubmit={handleSubmit}>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  <input
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
  <button type="submit">Login</button>
</form></div>
}
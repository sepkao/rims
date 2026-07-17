import {useEffect} from 'react'
import {useAuth} from '../contexts/AuthContext.tsx'
import {useNavigate} from 'react-router-dom'

export default function Login() {
    const { role, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && role==="owner") {
            navigate(`/owner/dashboard`,{ replace: true});
        }
    }, [role, loading, navigate])

    if (loading) return <p>Loading...</p>

    return <p>login from goes here but not  built</p>
}
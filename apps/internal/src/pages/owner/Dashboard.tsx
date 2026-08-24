import {useAuth} from '../../contexts/AuthContext.tsx'

import { Link } from 'react-router-dom'

export default function Dashboard() {
    const { role, logout } = useAuth();

    return (
        <div>
            <p>Welcome, {role}!</p>
            <div>
                <Link to="/owner/menu" className="button-style">Go to Menu Management</Link>
            </div>
            
            
        </div>
        
    );
}

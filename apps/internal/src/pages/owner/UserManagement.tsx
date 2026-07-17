import {useAuth} from '../../contexts/AuthContext.tsx'

export default function UserManagement() {
   const { logout } = useAuth();


   return (
         <div>
            <h1>User Management</h1>
            <p>This is the User Management page for owners.</p>
            <button onClick={logout}>Logout</button>
         </div>
   )
}
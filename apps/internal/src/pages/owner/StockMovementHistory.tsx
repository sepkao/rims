import {useAuth} from '../../contexts/AuthContext.tsx'

export default function StockMovementHistory() {
   const { logout } = useAuth();
   return (
        <div>
            <h1>Stock Movement History</h1>
            <p>View all stock intake, transfer, and deduction records here.</p>
            <button onClick={logout}>Logout</button>
        </div>
   )
}
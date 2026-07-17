import {useAuth} from '../../contexts/AuthContext.tsx'

export default function IngredientSettings () {
   const { logout } = useAuth();

    return (    
        <div>
            <h1>Ingredient Settings</h1>
            <p>Set reorder threshold, thaw-prep threshold, and other per-ingredient settings here.</p>
            <button onClick={logout}>Logout</button>
        </div>
    
    )
}
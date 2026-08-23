import { createContext, useState, useContext } from "react"
import type { ReactNode } from "react"
export type Role = "owner" | "staff" | "cashier"

type AuthState = {
    role :Role | null;
    loading: boolean;
    login: (role: Role) => void;
    logout: () => void;
}


const AuthContext = createContext<AuthState>({ 
        role: null,
        loading: true,
        login: () => {},
        logout: () => {}
    });

export const AuthProvider = ({ children }: { children: ReactNode }) =>{
        const [role, setRole] = useState<Role | null>(null);
        const [loading, setLoading] = useState(false);

        function login(role: Role) {
            
            setRole(role);
        }
        async function logout() {
            await fetch('http://localhost:3000/auth/logout', { method: 'POST', credentials: 'include'})
            setRole(null);
        }
        return (
            <AuthContext.Provider value={{ role, loading, logout, login }}>
                {children}
            </AuthContext.Provider>
        );

    

}
export const useAuth = () => {
    return useContext(AuthContext);
}

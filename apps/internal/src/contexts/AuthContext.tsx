import { createContext, useState, useEffect, useContext } from "react"
import type { ReactNode } from "react"
export type Role = "owner" | "staff" | "cashier"

type AuthState = {
    role :Role | null;
    loading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthState>({ 
        role: null,
        loading: true,
        logout: () => {}
    });

export const AuthProvider = ({ children }: { children: ReactNode }) =>{
        const [role, setRole] = useState<Role | null>(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            const timer = setTimeout(() => {
                setRole("staff");
                setLoading(false);
            }, 300);
            return () => clearTimeout(timer);
        }, []);

        function logout() {
            setRole(null);
        }
        return (
            <AuthContext.Provider value={{ role, loading, logout }}>
                {children}
            </AuthContext.Provider>
        );

    

}
export const useAuth = () => {
    return useContext(AuthContext);
}

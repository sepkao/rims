import {useAuth} from '../../contexts/AuthContext.tsx'
const mockMenuItems = [
  { id: 1, name: 'หมูกระทะเผ็ด', price: 89, removableIngredients: ['พริก', 'ไก่'] },
  { id: 2, name: 'ผัดผักรวม', price: 59, removableIngredients: ['ผัก'] },
]

export default function Menu() {
    const { logout } = useAuth(); 

    return (
        <div>
            <h1>Menu Management</h1>
            <p>This is the Menu Management page for owners.</p>
            <ul>
                {mockMenuItems.map((item) => (
                <li key={item.id}>
                {item.name} — {item.price} บาท
                {item.removableIngredients.length > 0 && (
                    <span> (removable: {item.removableIngredients.join(', ')})</span>
                )}
                </li>
            ))}
        </ul>
            <button onClick={logout}>Logout</button>
        </div>
    );
}
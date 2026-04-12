import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, register as registerApi } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('name');
    if (token && role) {
      setUser({ token, role, name });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await loginApi({ email, password });
    const { access_token, role, name } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);
    localStorage.setItem('name', name);
    setUser({ token: access_token, role, name });
    return role;
  };

  const registerUser = async (data) => {
    const res = await registerApi(data);
    const { access_token, role, name } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);
    localStorage.setItem('name', name);
    setUser({ token: access_token, role, name });
    return role;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register: registerUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

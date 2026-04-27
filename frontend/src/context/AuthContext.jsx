import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, register as registerApi } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The user requested to not restore existing login and start new every time
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('primary_language');
    localStorage.removeItem('known_languages');
    localStorage.removeItem('department');
    localStorage.removeItem('skillsync_lang');
    setUser(null);
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await loginApi({ email, password });
    const { access_token, role, name, primary_language, known_languages, department } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);
    localStorage.setItem('name', name);
    localStorage.setItem('primary_language', primary_language || 'en');
    localStorage.setItem('known_languages', JSON.stringify(known_languages || ['en']));
    localStorage.setItem('department', department || 'HR');

    // Always set language to user's primary_language on login
    localStorage.setItem('skillsync_lang', primary_language || 'en');

    setUser({ token: access_token, role, name, primary_language: primary_language || 'en', known_languages: known_languages || ['en'], department: department || 'HR' });
    return role;
  };

  const registerUser = async (data) => {
    const res = await registerApi(data);
    const { access_token, role, name, primary_language, known_languages, department } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);
    localStorage.setItem('name', name);
    localStorage.setItem('primary_language', primary_language || 'en');
    localStorage.setItem('known_languages', JSON.stringify(known_languages || ['en']));
    localStorage.setItem('department', department || 'HR');
    localStorage.setItem('skillsync_lang', primary_language || 'en');

    setUser({ token: access_token, role, name, primary_language: primary_language || 'en', known_languages: known_languages || ['en'], department: department || 'HR' });
    return role;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('primary_language');
    localStorage.removeItem('known_languages');
    localStorage.removeItem('department');
    localStorage.removeItem('skillsync_lang');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register: registerUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

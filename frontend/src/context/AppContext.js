import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, TOKEN_KEY } from '@/lib/api';
import { translator } from '@/i18n';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const [metal, setMetalState] = useState(localStorage.getItem('fa_metal') || 'silver');
  const [workspace, setWorkspaceState] = useState(localStorage.getItem('fa_workspace') || 'real');
  const [lang, setLangState] = useState(localStorage.getItem('fa_lang') || 'hi');
  const [theme, setThemeState] = useState(localStorage.getItem('fa_theme') || 'light');

  const setMetal = useCallback((m) => { setMetalState(m); localStorage.setItem('fa_metal', m); }, []);
  const setWorkspace = useCallback((w) => { setWorkspaceState(w); localStorage.setItem('fa_workspace', w); }, []);
  const setLang = useCallback((l) => { setLangState(l); localStorage.setItem('fa_lang', l); }, []);
  const setTheme = useCallback((t) => { setThemeState(t); localStorage.setItem('fa_theme', t); }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const loadMe = useCallback(async () => {
    const tk = localStorage.getItem(TOKEN_KEY);
    if (!tk) { setReady(true); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setToken(tk);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const applyLogin = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const loginAdmin = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    applyLogin(data);
    return data;
  }, [applyLogin]);

  const loginCode = useCallback(async (code) => {
    const { data } = await api.post('/auth/code-login', { code });
    applyLogin(data);
    return data;
  }, [applyLogin]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const t = useMemo(() => translator(lang), [lang]);

  const value = {
    token, user, ready, metal, setMetal, workspace, setWorkspace,
    lang, setLang, theme, setTheme, loginAdmin, loginCode, logout, t,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    canManage: user?.role === 'admin' || user?.role === 'manager',
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// src/context/AuthContext.jsx  (FULL REPLACEMENT)

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

// const MOCK_MODE = true;
const MOCK_MODE = false;
const MOCK_USER = {
  id: '1', name: 'Test User', email: 'test@studystride.com',
  age: '17', gender: 'male', declaredLevel: 'Class 11 (Science)',
  photo: null,
  classEnrolledAt: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString(),
};

// Returns true if today is in the March–April window AND it's been ~11+ months since enrollment
const shouldPromptClassUpgrade = (user) => {
  if (!user?.classEnrolledAt || !user?.declaredLevel) return false;
  // Only prompt for school/undergrad levels, not "Other" or "Competitive Exam Prep"
  const upgradable = user.declaredLevel.startsWith('Class') || user.declaredLevel.includes('Year');
  if (!upgradable) return false;

  const enrolled = new Date(user.classEnrolledAt);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - enrolled.getFullYear()) * 12 + (now.getMonth() - enrolled.getMonth());
  const inUpgradeSeason = now.getMonth() === 2 || now.getMonth() === 3; // March=2, April=3
  const alreadyPromptedThisYear = user.lastUpgradePromptYear === now.getFullYear();

  return inUpgradeSeason && monthsElapsed >= 10 && !alreadyPromptedThisYear;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    if (MOCK_MODE) {
      const stored = localStorage.getItem('ss_mock_user');
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        if (shouldPromptClassUpgrade(u)) setShowUpgradePrompt(true);
      }
      setLoading(false);
      return;
    }
    const token = localStorage.getItem('ss_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          if (shouldPromptClassUpgrade(res.data)) setShowUpgradePrompt(true);
        })
        .catch(() => localStorage.removeItem('ss_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const saveUser = (u) => {
    setUser(u);
    if (MOCK_MODE) localStorage.setItem('ss_mock_user', JSON.stringify(u));
  };

  const login = async (email, password) => {
    if (MOCK_MODE) {
      const u = { ...MOCK_USER, email };
      saveUser(u);
      if (shouldPromptClassUpgrade(u)) setShowUpgradePrompt(true);
      return;
    }
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('ss_token', res.data.token);
    setUser(res.data.user);
    if (shouldPromptClassUpgrade(res.data.user)) setShowUpgradePrompt(true);
  };

  // register now accepts extra profile fields
  const register = async (name, email, password, profile = {}) => {
    if (MOCK_MODE) {
      const u = { ...MOCK_USER, name, email, ...profile };
      saveUser(u);
      return;
    }
    const res = await api.post('/auth/register', { name, email, password, ...profile });
    localStorage.setItem('ss_token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_mock_user');
    setUser(null);
  };

  // Called when user confirms class upgrade in the popup
  const upgradeClass = (newLevel) => {
    const updated = {
      ...user,
      declaredLevel: newLevel,
      classEnrolledAt: new Date().toISOString(),
      lastUpgradePromptYear: new Date().getFullYear(),
    };
    saveUser(updated);
    setShowUpgradePrompt(false);
    if (!MOCK_MODE) {
      api.put('/auth/profile', { declaredLevel: newLevel, classEnrolledAt: updated.classEnrolledAt })
        .catch(console.error);
    }
  };

  // Called when user dismisses the popup ("Not yet")
  const dismissUpgrade = () => {
    const updated = { ...user, lastUpgradePromptYear: new Date().getFullYear() };
    saveUser(updated);
    setShowUpgradePrompt(false);
    if (!MOCK_MODE) {
      api.put('/auth/profile', { lastUpgradePromptYear: updated.lastUpgradePromptYear }).catch(console.error);
    }
  };

  const updateProfile = (fields) => {
    const updated = { ...user, ...fields };
    saveUser(updated);
    if (!MOCK_MODE) {
      api.put('/auth/profile', fields).catch(console.error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateProfile,
      showUpgradePrompt, upgradeClass, dismissUpgrade,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
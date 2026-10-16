import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Two-level cache:
// 1. In-memory cache (current tab session)
// 2. localStorage cache (survives reloads until the user clears browser data,
//    expires after 12h so settings changes still propagate)
const LS_KEY = 'sa_site_settings';
const LS_TTL = 12 * 60 * 60 * 1000; // 12 hours

const readPersistedSettings = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return parsed.data || null;
  } catch {
    return null;
  }
};

const writePersistedSettings = (settings) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data: settings, expiresAt: Date.now() + LS_TTL }));
  } catch { /* storage full - ignore */ }
};

let cachedSettings = readPersistedSettings();
let cachePromise = null;

const fetchPublicSettings = () => {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (cachePromise) return cachePromise;

  cachePromise = axios.get(`${API_URL}/api/settings/public`)
    .then(({ data }) => {
      cachedSettings = data.data.settings || {};
      writePersistedSettings(cachedSettings);
      return cachedSettings;
    })
    .catch(() => {
      cachePromise = null;
      return {};
    });

  return cachePromise;
};

const useSiteSettings = () => {
  const [settings, setSettings] = useState(cachedSettings || {});
  const [loaded, setLoaded] = useState(!!cachedSettings);

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings().then((s) => {
      if (!cancelled) {
        setSettings(s);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { settings, loaded };
};

export default useSiteSettings;

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let cachedSettings = null;
let cachePromise = null;

const fetchPublicSettings = () => {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (cachePromise) return cachePromise;

  cachePromise = axios.get(`${API_URL}/api/settings/public`)
    .then(({ data }) => {
      cachedSettings = data.data.settings || {};
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

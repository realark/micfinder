const API_URL = import.meta.env.VITE_MICFINDER_API_URL;
const MIC_CACHE_KEY = `micfinder:mics:v1:${API_URL}`;

const isMicList = (mics) => Array.isArray(mics) && mics.every(mic =>
  mic && mic.id != null && typeof mic.name === 'string' &&
  typeof mic.startDate === 'string'
);

export const readCachedMics = () => {
  try {
    const mics = JSON.parse(localStorage.getItem(MIC_CACHE_KEY));
    return isMicList(mics) ? mics : null;
  } catch {
    return null; // Storage can be unavailable or contain an invalid cache.
  }
};

export const cacheMics = (mics) => {
  try {
    localStorage.setItem(MIC_CACHE_KEY, JSON.stringify(mics));
  } catch {
    // Disabled storage or a full quota must not prevent live browsing.
  }
};

export const readMics = async ({ fresh = false, signal } = {}) => {
  if (!fresh) {
    const mics = readCachedMics();
    if (mics !== null) return mics;
  }

  const response = await fetch(`${API_URL}/mics`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch open mics');
  const data = await response.json();
  const mics = data.mics ?? data;
  if (!isMicList(mics)) throw new Error('Unexpected open mics response');
  return mics;
};

// Browsing uses the current list; edits explicitly bypass it for edit_version.
export const readMic = async (id, { mics, fresh = false, signal } = {}) => {
  if (!fresh) {
    const mic = (mics ?? readCachedMics())?.find(mic => String(mic.id) === String(id));
    if (mic) return mic;
  }

  const response = await fetch(`${API_URL}/mics/${id}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch open mic details');
  const { mic } = await response.json();
  if (!isMicList([mic])) throw new Error('Unexpected open mic response');
  return mic;
};

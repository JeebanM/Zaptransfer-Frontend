const SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Token management (localStorage)
 */
export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('zap_token');
};

export const setToken = (token) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('zap_token', token);
};

export const removeToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('zap_token');
};

export const isLoggedIn = () => {
  return !!getToken();
};

/**
 * Decode JWT payload (without verification — server verifies)
 */
export const getUserInfo = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
};

/**
 * Verify token with server
 */
export const verifyTokenWithServer = async () => {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${SERVER_URL}/auth/verify?token=${token}`);
    const data = await res.json();
    return data.valid;
  } catch {
    return false;
  }
};

/**
 * Get Google OAuth login URL
 */
export const getLoginUrl = () => {
  return `${SERVER_URL}/auth/google`;
};

/**
 * Logout
 */
export const logout = () => {
  removeToken();
  window.location.href = '/login';
};

/**
 * Authenticated fetch helper
 */
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  return fetch(`${SERVER_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
};

/**
 * Creates a fetch wrapper that calls onUnauthorized() whenever the server
 * returns 401 (expired or invalid JWT), then throws so callers can bail out.
 * Used in App.jsx to redirect users to the login screen automatically.
 */
export const makeAuthFetch = (onUnauthorized) => async (url, options = {}) => {
  const res = await fetch(url, options);
  if (res.status === 401) {
    onUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  return res;
};

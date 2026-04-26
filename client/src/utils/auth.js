let refreshTimeout;

export function scheduleTokenRefresh(token, setToken, serverUrl) {
  const payload = JSON.parse(atob(token.split(".")[1]));

  const expiry = payload.exp * 1000;
  const now = Date.now();

  const delay = expiry - now - 60000;

  if (refreshTimeout) clearTimeout(refreshTimeout);

  refreshTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${serverUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setToken(data.token);

      scheduleTokenRefresh(data.token, setToken, serverUrl);
    } catch {
      setToken("");
    }
  }, delay);
}
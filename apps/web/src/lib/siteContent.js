export async function fetchSiteContent() {
  try {
    const res = await fetch('/api/content.php', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.reviews) || !data?.records?.directeur || !data?.records?.vaisseau) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function loginManager(email, password) {
  const res = await fetch('/api/login.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Identifiants incorrects');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchMe() {
  try {
    const res = await fetch('/api/me.php', { credentials: 'include' });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function logoutManager() {
  await fetch('/api/logout.php', { method: 'POST', credentials: 'include' });
}

export async function saveSiteContent(payload) {
  const res = await fetch('/api/content.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Enregistrement impossible, réessaie.');
    err.status = res.status;
    throw err;
  }
  return data;
}

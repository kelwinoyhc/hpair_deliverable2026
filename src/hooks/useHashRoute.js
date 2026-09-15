import { useEffect, useState } from 'react';

/**
 * The app's only routing: reads `window.location.hash`.
 *
 * A hash was chosen over react-router deliberately. The form itself needs no
 * routes (its position is wizard state), so the only thing to route is the admin
 * view -- and a hash costs no dependency, requires no `vercel.json` rewrite, and
 * cannot 404 on refresh, because the server never sees it. `/#admin` is served
 * the same index.html as `/`.
 *
 * The trade-off is that a hash is not a real URL path, so it is worse for deep
 * linking and analytics. For one hidden internal view, that is the right side of
 * the trade.
 */
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ''));

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return hash;
}

import React from 'react';
import { mediaURL } from '../utils/ui';

export const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2-5a8.5 8.5 0 1 1 16-3.5Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 3H4v18h5M10 12h12m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3M9 14l6 3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  sparkle: '<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  pin: '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>'
};

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: paths[name] || paths.sparkle }}
    />
  );
}

export function Avatar({ user, className = '' }) {
  const [src, setSrc] = React.useState(mediaURL(user?.avatar));

  React.useEffect(() => {
    setSrc(mediaURL(user?.avatar));
  }, [user?.avatar]);

  return (
    <img
      className={`avatar ${className}`}
      src={src}
      alt={user?.name || 'Profile'}
      loading="lazy"
      onError={() => setSrc('/src/assets/logo.png')}
    />
  );
}

export const providers = { google: 'Google', apple: 'Apple', github: 'GitHub', discord: 'Discord', twitter: 'X' };

export const providerPaths = {
  google: '<path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.6-2.4l-3.2-2.6c-.9.6-2 1-3.4 1a6 6 0 0 1-5.7-4.2H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.8a6 6 0 0 1 0-3.6V7.5H3a10 10 0 0 0 0 9l3.3-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.5 9.5 0 0 0 12 2a10 10 0 0 0-9 5.5l3.3 2.7A6 6 0 0 1 12 6Z"/>',
  apple: '<path fill="currentColor" d="M16.4 1.4c.2 1.4-.4 2.8-1.2 3.8-.9 1-2.2 1.7-3.5 1.6-.2-1.3.5-2.7 1.3-3.6.9-1 2.3-1.7 3.4-1.8ZM20.8 17.8c-.6 1.4-.9 2-1.7 3.2-1 1.4-2.3 3.1-3.9 3.1-1.4 0-1.8-.9-3.7-.9-1.8 0-2.3.9-3.7.9-1.5 0-2.7-1.5-3.7-3-2.8-3.9-3.1-8.5-1.4-11 1.2-1.8 3-2.8 4.7-2.8 1.5 0 2.5.9 3.8.9s2.1-.9 3.8-.9c1.5 0 3.1.9 4.3 2.3-3.7 2-3.1 7.1 1.5 8.2Z" transform="translate(1 0) scale(.9)"/>',
  github: '<path fill="currentColor" d="M12 .8a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.9 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.8 5.5-5.5 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .8Z"/>',
  discord: '<path fill="currentColor" d="M19.6 5.3A18 18 0 0 0 15.4 4l-.5 1a16 16 0 0 0-5.8 0l-.5-1a18 18 0 0 0-4.2 1.3C1.7 9.2 1 13 1.3 16.8a17 17 0 0 0 5.2 2.6l1.1-1.8-1.7-.8.4-.3a12 12 0 0 0 11.4 0l.4.3-1.7.8 1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.5-.8-8.3-3.1-11.5ZM8.4 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.2 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/>',
  twitter: '<path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L5.5 22H2.3l7.4-8.6L2 2h6.5l4.4 6.7L18.9 2ZM17.8 20h1.7L7.5 3.9H5.7L17.8 20Z"/>'
};

export function ProviderMark({ provider, size = 20 }) {
  return (
    <svg
      className={`provider-mark ${provider}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: providerPaths[provider] || '' }}
    />
  );
}

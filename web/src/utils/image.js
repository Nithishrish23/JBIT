import { baseURL } from "../api/client";

export const getImageUrl = (url) => {
  if (!url) return 'https://via.placeholder.com/300?text=No+Image';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Remove leading slash to avoid double slashes if baseURL has trailing slash
  const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
  
  // Ensure baseURL ends with a slash or handle joining carefully
  const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  
  return `${base}${cleanUrl}`;
};

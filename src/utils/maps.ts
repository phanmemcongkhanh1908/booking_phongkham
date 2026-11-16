/**
 * Generates a Google Maps Directions URL for a given clinic street address.
 */
export function buildGoogleMapsDirectionsUrl(address?: string | null): string {
  const cleaned = (address || '').trim();
  if (!cleaned) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleaned)}`;
}

/**
 * Strips redundant outer quotation marks from clinic slogans before wrapping them in display quotes.
 */
export function formatClinicSlogan(slogan?: string | null): string {
  const cleaned = (slogan || '').trim();
  return cleaned.replace(/^["'“”„]+|["'“”„]+$/g, '').trim();
}

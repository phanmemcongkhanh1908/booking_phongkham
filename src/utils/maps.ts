/**
 * Generates a Google Maps Directions URL prioritizing exact clinic coordinates
 * (latitude, longitude) when available, falling back to the street address.
 */
export function buildGoogleMapsDirectionsUrl(
  address?: string | null,
  latitude?: number | null,
  longitude?: number | null
): string {
  const lat = latitude !== null && latitude !== undefined ? Number(latitude) : NaN;
  const lng = longitude !== null && longitude !== undefined ? Number(longitude) : NaN;

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

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

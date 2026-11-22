/**
 * Weather forecast via Open-Meteo (free, no API key, CC BY 4.0 data).
 * The forecast is an estimate and is labelled as such in the UI.
 */
export interface WeatherSummary {
  temperature: number | null;
  max: number | null;
  min: number | null;
  rainProbability: number | null;
  code: number | null;
  fetchedAt: string;
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rainy' | 'snow' | 'storm';

/** WMO weather interpretation codes → simplified kinds. */
export function weatherKind(code: number | null | undefined): WeatherKind | null {
  if (code == null) return null;
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export function openMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Europe/Madrid',
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function parseOpenMeteo(json: unknown, now: Date = new Date()): WeatherSummary {
  const j = (json ?? {}) as {
    current?: { temperature_2m?: number; weather_code?: number };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
  };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
  return {
    temperature: num(j.current?.temperature_2m),
    code: typeof j.current?.weather_code === 'number' ? j.current.weather_code : null,
    max: num(j.daily?.temperature_2m_max?.[0]),
    min: num(j.daily?.temperature_2m_min?.[0]),
    rainProbability: num(j.daily?.precipitation_probability_max?.[0]),
    fetchedAt: now.toISOString(),
  };
}

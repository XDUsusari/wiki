import { openMeteoUrl, parseOpenMeteo, type WeatherSummary } from '@dinsdelparc/shared';

/** Forecast for the resort area (approximate centre from app_settings). */
export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherSummary> {
  const res = await fetch(openMeteoUrl(latitude, longitude));
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return parseOpenMeteo(await res.json());
}

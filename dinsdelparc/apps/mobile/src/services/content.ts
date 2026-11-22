import type {
  Announcement,
  Attraction,
  AttractionLiveStatus,
  FeaturedItem,
  LocationRow,
  Park,
  ParkSchedule,
  ParkService,
  Restaurant,
  Shop,
  Show,
  ShowSession,
  ThemedArea,
} from '@dinsdelparc/shared';
import { toIsoDate } from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';

export async function fetchParks(): Promise<Park[]> {
  return unwrap(await supabase.from('parks').select('*').order('sort_order')) as Park[];
}

export interface ParkBundle {
  park: Park;
  areas: ThemedArea[];
  attractions: Attraction[];
  restaurants: Restaurant[];
  shops: Shop[];
  shows: Show[];
  services: ParkService[];
  schedules: ParkSchedule[];
  announcements: Announcement[];
}

export async function fetchParkBundle(slug: string): Promise<ParkBundle> {
  const park = unwrap(await supabase.from('parks').select('*').eq('slug', slug).single()) as Park;
  const today = toIsoDate(new Date());
  const [areas, attractions, restaurants, shops, shows, services, schedules, announcements] = await Promise.all([
    supabase.from('themed_areas').select('*').eq('park_id', park.id).order('sort_order'),
    supabase.from('attractions').select('*').eq('park_id', park.id).order('sort_order'),
    supabase.from('restaurants').select('*').eq('park_id', park.id).order('name'),
    supabase.from('shops').select('*').eq('park_id', park.id).order('name'),
    supabase.from('shows').select('*').eq('park_id', park.id).order('name'),
    supabase.from('park_services').select('*').eq('park_id', park.id).order('name'),
    supabase.from('park_schedules').select('*').eq('park_id', park.id).gte('schedule_date', today).order('schedule_date').limit(14),
    supabase.from('announcements').select('*').eq('park_id', park.id).order('starts_at', { ascending: false }).limit(10),
  ]);
  return {
    park,
    areas: unwrap(areas) as ThemedArea[],
    attractions: unwrap(attractions) as Attraction[],
    restaurants: unwrap(restaurants) as Restaurant[],
    shops: unwrap(shops) as Shop[],
    shows: unwrap(shows) as Show[],
    services: unwrap(services) as ParkService[],
    schedules: unwrap(schedules) as ParkSchedule[],
    announcements: unwrap(announcements) as Announcement[],
  };
}

export async function fetchTodaySchedules(): Promise<ParkSchedule[]> {
  const today = toIsoDate(new Date());
  return unwrap(await supabase.from('park_schedules').select('*').eq('schedule_date', today)) as ParkSchedule[];
}

export interface AttractionBundle {
  attraction: Attraction;
  park: Park;
  area: ThemedArea | null;
  related: Attraction[];
  incidents: Announcement[];
}

export async function fetchAttraction(id: string): Promise<AttractionBundle> {
  const attraction = unwrap(await supabase.from('attractions').select('*').eq('id', id).single()) as Attraction;
  const [park, area, related, incidents] = await Promise.all([
    supabase.from('parks').select('*').eq('id', attraction.park_id).single(),
    attraction.area_id
      ? supabase.from('themed_areas').select('*').eq('id', attraction.area_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('attractions')
      .select('*')
      .eq('park_id', attraction.park_id)
      .neq('id', attraction.id)
      .or(`area_id.eq.${attraction.area_id ?? '00000000-0000-0000-0000-000000000000'},attraction_type.eq.${attraction.attraction_type}`)
      .limit(6),
    supabase.from('announcements').select('*').eq('attraction_id', attraction.id).order('starts_at', { ascending: false }).limit(5),
  ]);
  return {
    attraction,
    park: unwrap(park) as Park,
    area: (unwrap(area) as ThemedArea | null) ?? null,
    related: unwrap(related) as Attraction[],
    incidents: unwrap(incidents) as Announcement[],
  };
}

export type VenueKind = 'restaurant' | 'shop' | 'show' | 'service';
const VENUE_TABLE: Record<VenueKind, string> = {
  restaurant: 'restaurants',
  shop: 'shops',
  show: 'shows',
  service: 'park_services',
};

export interface VenueBundle {
  kind: VenueKind;
  venue: Restaurant | Shop | Show | ParkService;
  park: Park;
  area: ThemedArea | null;
  sessions: ShowSession[];
}

export async function fetchVenue(kind: VenueKind, id: string): Promise<VenueBundle> {
  const venue = unwrap(await supabase.from(VENUE_TABLE[kind]).select('*').eq('id', id).single()) as Restaurant;
  const [park, area, sessions] = await Promise.all([
    supabase.from('parks').select('*').eq('id', venue.park_id).single(),
    venue.area_id ? supabase.from('themed_areas').select('*').eq('id', venue.area_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    kind === 'show'
      ? supabase.from('show_sessions').select('*').eq('show_id', id).gte('session_date', toIsoDate(new Date())).order('session_date').order('starts_at').limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    kind,
    venue,
    park: unwrap(park) as Park,
    area: (unwrap(area) as ThemedArea | null) ?? null,
    sessions: (unwrap(sessions) as ShowSession[]) ?? [],
  };
}

export async function fetchArea(id: string) {
  const area = unwrap(await supabase.from('themed_areas').select('*').eq('id', id).single()) as ThemedArea;
  const [park, attractions, restaurants, shops, shows] = await Promise.all([
    supabase.from('parks').select('*').eq('id', area.park_id).single(),
    supabase.from('attractions').select('*').eq('area_id', id).order('sort_order'),
    supabase.from('restaurants').select('*').eq('area_id', id).order('name'),
    supabase.from('shops').select('*').eq('area_id', id).order('name'),
    supabase.from('shows').select('*').eq('area_id', id).order('name'),
  ]);
  return {
    area,
    park: unwrap(park) as Park,
    attractions: unwrap(attractions) as Attraction[],
    restaurants: unwrap(restaurants) as Restaurant[],
    shops: unwrap(shops) as Shop[],
    shows: unwrap(shows) as Show[],
  };
}

export async function fetchLiveStatus(): Promise<AttractionLiveStatus[]> {
  return unwrap(await supabase.from('attraction_live_status').select('*')) as AttractionLiveStatus[];
}

export async function fetchFeatured(): Promise<FeaturedItem[]> {
  return unwrap(await supabase.from('featured_items').select('*').order('sort_order').limit(12)) as FeaturedItem[];
}

export async function fetchAnnouncements(limit = 6): Promise<Announcement[]> {
  return unwrap(await supabase.from('announcements').select('*').order('starts_at', { ascending: false }).limit(limit)) as Announcement[];
}

export async function fetchAllAttractions(): Promise<Attraction[]> {
  return unwrap(await supabase.from('attractions').select('*').order('sort_order')) as Attraction[];
}

export interface MapData {
  locations: LocationRow[];
  attractions: Pick<Attraction, 'id' | 'name' | 'location_id' | 'park_id'>[];
  restaurants: Pick<Restaurant, 'id' | 'name' | 'location_id' | 'park_id'>[];
  shops: Pick<Shop, 'id' | 'name' | 'location_id' | 'park_id'>[];
  shows: Pick<Show, 'id' | 'name' | 'location_id' | 'park_id'>[];
  services: Pick<ParkService, 'id' | 'name' | 'location_id' | 'park_id' | 'service_type'>[];
}

export async function fetchMapData(): Promise<MapData> {
  const cols = 'id,name,location_id,park_id';
  const [locations, attractions, restaurants, shops, shows, services] = await Promise.all([
    supabase.from('locations').select('*'),
    supabase.from('attractions').select(cols),
    supabase.from('restaurants').select(cols),
    supabase.from('shops').select(cols),
    supabase.from('shows').select(cols),
    supabase.from('park_services').select(`${cols},service_type`),
  ]);
  return {
    locations: unwrap(locations) as LocationRow[],
    attractions: unwrap(attractions) as MapData['attractions'],
    restaurants: unwrap(restaurants) as MapData['restaurants'],
    shops: unwrap(shops) as MapData['shops'],
    shows: unwrap(shows) as MapData['shows'],
    services: unwrap(services) as MapData['services'],
  };
}

export interface PublicSettings {
  mapDefaultView: { latitude: number; longitude: number; zoom: number; verified: boolean } | null;
  termsVersion: string;
  contactEmail: string | null;
  maxImagesPerPost: number;
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  const rows = unwrap(await supabase.from('app_settings').select('key,value').eq('is_public', true)) as { key: string; value: unknown }[];
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    mapDefaultView: (get('map.default_view') as PublicSettings['mapDefaultView']) ?? null,
    termsVersion: (get('legal.terms_version') as string) ?? '2026-11',
    contactEmail: (get('legal.contact_email') as string) ?? null,
    maxImagesPerPost: Number(get('community.max_images_per_post') ?? 4),
  };
}

export interface PlannerCatalog {
  parks: Pick<Park, 'id' | 'name' | 'accent_color' | 'sort_order'>[];
  areas: Pick<ThemedArea, 'id' | 'name' | 'park_id' | 'sort_order' | 'accent_color'>[];
  attractions: Pick<Attraction, 'id' | 'name' | 'park_id' | 'area_id' | 'attraction_type'>[];
  shows: Pick<Show, 'id' | 'name' | 'park_id' | 'area_id'>[];
  restaurants: Pick<Restaurant, 'id' | 'name' | 'park_id' | 'area_id'>[];
  shops: Pick<Shop, 'id' | 'name' | 'park_id' | 'area_id'>[];
}

/** Lightweight catalogue used by the planner (cached for offline use). */
export async function fetchPlannerCatalog(): Promise<PlannerCatalog> {
  const [parks, areas, attractions, shows, restaurants, shops] = await Promise.all([
    supabase.from('parks').select('id,name,accent_color,sort_order').order('sort_order'),
    supabase.from('themed_areas').select('id,name,park_id,sort_order,accent_color').order('sort_order'),
    supabase.from('attractions').select('id,name,park_id,area_id,attraction_type').order('sort_order'),
    supabase.from('shows').select('id,name,park_id,area_id').order('name'),
    supabase.from('restaurants').select('id,name,park_id,area_id').order('name'),
    supabase.from('shops').select('id,name,park_id,area_id').order('name'),
  ]);
  return {
    parks: unwrap(parks) as PlannerCatalog['parks'],
    areas: unwrap(areas) as PlannerCatalog['areas'],
    attractions: unwrap(attractions) as PlannerCatalog['attractions'],
    shows: unwrap(shows) as PlannerCatalog['shows'],
    restaurants: unwrap(restaurants) as PlannerCatalog['restaurants'],
    shops: unwrap(shops) as PlannerCatalog['shops'],
  };
}

/** Verified, published show sessions for a date. */
export async function fetchSessionsForDate(date: string): Promise<ShowSession[]> {
  return unwrap(
    await supabase.from('show_sessions').select('*').eq('session_date', date).eq('data_origin', 'verified').order('starts_at'),
  ) as ShowSession[];
}

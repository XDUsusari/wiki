import type { TKey } from '@dinsdelparc/shared';

export type FieldType = 'text' | 'textarea' | 'i18n' | 'i18nLong' | 'number' | 'boolean' | 'select' | 'fk' | 'color' | 'url' | 'date' | 'time' | 'datetime' | 'decimal';

export interface FieldDef {
  name: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  /** For fk fields: referenced table (rows need id + name or slug). */
  ref?: 'parks' | 'themed_areas' | 'locations' | 'shows' | 'attractions';
  min?: number;
  max?: number;
  /** Safety / operational fields: highlighted with the verification note. */
  sensitive?: boolean;
  /** Value used when the input is left empty (for NOT NULL columns with a default). */
  defaultValue?: number | string;
}

export interface TableDef {
  table: ContentTable;
  label: TKey;
  titleField: string;
  orderBy: string;
  listFields: string[];
  fields: FieldDef[];
  /** Permission needed to create/update (DB policies mirror this). */
  writePermission: 'content.edit' | 'content.feature';
}

export const CONTENT_TABLES = [
  'parks',
  'themed_areas',
  'attractions',
  'restaurants',
  'shops',
  'shows',
  'show_sessions',
  'park_services',
  'park_schedules',
  'locations',
  'announcements',
  'featured_items',
] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

const ORIGIN = { name: 'data_origin', type: 'select', options: ['pending_verification', 'verified', 'demo', 'community'], required: true } as const satisfies FieldDef;
const PUBLISHED = { name: 'is_published', type: 'boolean' } as const satisfies FieldDef;
const SOURCE = { name: 'source_url', type: 'url' } as const satisfies FieldDef;
const IMAGE: FieldDef[] = [
  { name: 'hero_image_path', type: 'text', max: 300 },
  { name: 'image_credit', type: 'text', max: 200 },
];
const VENUE_BASE: FieldDef[] = [
  { name: 'park_id', type: 'fk', ref: 'parks', required: true },
  { name: 'area_id', type: 'fk', ref: 'themed_areas' },
  { name: 'location_id', type: 'fk', ref: 'locations' },
  { name: 'name', type: 'text', required: true, max: 120 },
  { name: 'slug', type: 'text', required: true, max: 80 },
  { name: 'description_i18n', type: 'i18nLong' },
];

export const CONTENT: Record<ContentTable, TableDef> = {
  parks: {
    table: 'parks',
    label: 'admin.content.tables.parks',
    titleField: 'name',
    orderBy: 'sort_order',
    listFields: ['name', 'kind', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      { name: 'name', type: 'text', required: true, max: 120 },
      { name: 'slug', type: 'text', required: true, max: 60 },
      { name: 'kind', type: 'select', options: ['theme_park', 'water_park'], required: true },
      { name: 'accent_color', type: 'color', required: true },
      { name: 'tagline_i18n', type: 'i18n' },
      { name: 'description_i18n', type: 'i18nLong' },
      { name: 'season_i18n', type: 'i18n', sensitive: true },
      { name: 'official_url', type: 'url' },
      ...IMAGE,
      { name: 'sort_order', type: 'number', min: 0, max: 100, defaultValue: 0 },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  themed_areas: {
    table: 'themed_areas',
    label: 'admin.content.tables.themed_areas',
    titleField: 'name',
    orderBy: 'sort_order',
    listFields: ['name', 'park_id', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      { name: 'park_id', type: 'fk', ref: 'parks', required: true },
      { name: 'name', type: 'text', required: true, max: 120 },
      { name: 'slug', type: 'text', required: true, max: 60 },
      { name: 'accent_color', type: 'color', required: true },
      { name: 'description_i18n', type: 'i18nLong' },
      ...IMAGE,
      { name: 'sort_order', type: 'number', min: 0, max: 100, defaultValue: 0 },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  attractions: {
    table: 'attractions',
    label: 'admin.content.tables.attractions',
    titleField: 'name',
    orderBy: 'sort_order',
    listFields: ['name', 'park_id', 'attraction_type', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      ...VENUE_BASE,
      {
        name: 'attraction_type',
        type: 'select',
        required: true,
        options: ['roller_coaster', 'water_ride', 'drop_tower', 'flat_ride', 'family', 'kids', 'dark_ride', 'simulator', 'slide', 'pool', 'walkthrough', 'other'],
      },
      { name: 'intensity', type: 'select', options: ['low', 'moderate', 'high', 'extreme'], sensitive: true },
      { name: 'min_height_cm', type: 'number', min: 50, max: 220, sensitive: true },
      { name: 'min_height_accompanied_cm', type: 'number', min: 50, max: 220, sensitive: true },
      { name: 'max_height_cm', type: 'number', min: 50, max: 230, sensitive: true },
      { name: 'duration_seconds', type: 'number', min: 10, max: 7200, sensitive: true },
      { name: 'restrictions_i18n', type: 'i18nLong', sensitive: true },
      { name: 'accessibility_i18n', type: 'i18nLong', sensitive: true },
      { name: 'opened_year', type: 'number', min: 1900, max: 2100 },
      ...IMAGE,
      { name: 'image_license', type: 'text', max: 100 },
      { name: 'sort_order', type: 'number', min: 0, max: 1000, defaultValue: 0 },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  restaurants: {
    table: 'restaurants',
    label: 'admin.content.tables.restaurants',
    titleField: 'name',
    orderBy: 'name',
    listFields: ['name', 'park_id', 'service_type', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      ...VENUE_BASE,
      { name: 'cuisine', type: 'text', max: 80 },
      { name: 'service_type', type: 'select', options: ['table', 'buffet', 'quick', 'snack', 'other'], required: true },
      { name: 'price_range', type: 'number', min: 1, max: 4, sensitive: true },
      { name: 'dietary_i18n', type: 'i18n', sensitive: true },
      ...IMAGE,
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  shops: {
    table: 'shops',
    label: 'admin.content.tables.shops',
    titleField: 'name',
    orderBy: 'name',
    listFields: ['name', 'park_id', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [...VENUE_BASE, ...IMAGE, SOURCE, ORIGIN, PUBLISHED],
  },
  shows: {
    table: 'shows',
    label: 'admin.content.tables.shows',
    titleField: 'name',
    orderBy: 'name',
    listFields: ['name', 'park_id', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      ...VENUE_BASE,
      { name: 'duration_seconds', type: 'number', min: 60, max: 14400, sensitive: true },
      { name: 'season_i18n', type: 'i18n', sensitive: true },
      ...IMAGE,
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  show_sessions: {
    table: 'show_sessions',
    label: 'admin.content.tables.show_sessions',
    titleField: 'session_date',
    orderBy: 'session_date',
    listFields: ['show_id', 'session_date', 'starts_at', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      { name: 'show_id', type: 'fk', ref: 'shows', required: true },
      { name: 'session_date', type: 'date', required: true, sensitive: true },
      { name: 'starts_at', type: 'time', required: true, sensitive: true },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  park_services: {
    table: 'park_services',
    label: 'admin.content.tables.park_services',
    titleField: 'name',
    orderBy: 'name',
    listFields: ['name', 'park_id', 'service_type', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      { name: 'park_id', type: 'fk', ref: 'parks', required: true },
      { name: 'area_id', type: 'fk', ref: 'themed_areas' },
      { name: 'location_id', type: 'fk', ref: 'locations' },
      { name: 'name', type: 'text', required: true, max: 120 },
      { name: 'slug', type: 'text', required: true, max: 80 },
      {
        name: 'service_type',
        type: 'select',
        required: true,
        options: ['toilets', 'first_aid', 'lockers', 'guest_services', 'baby_care', 'accessibility', 'atm', 'photo', 'rental', 'lost_found', 'parking', 'other'],
      },
      { name: 'description_i18n', type: 'i18n' },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  park_schedules: {
    table: 'park_schedules',
    label: 'admin.content.tables.park_schedules',
    titleField: 'schedule_date',
    orderBy: 'schedule_date',
    listFields: ['park_id', 'schedule_date', 'opens_at', 'closes_at', 'is_closed', 'data_origin', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      { name: 'park_id', type: 'fk', ref: 'parks', required: true },
      { name: 'schedule_date', type: 'date', required: true, sensitive: true },
      { name: 'is_closed', type: 'boolean', sensitive: true },
      { name: 'opens_at', type: 'time', sensitive: true },
      { name: 'closes_at', type: 'time', sensitive: true },
      { name: 'note_i18n', type: 'i18n' },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  locations: {
    table: 'locations',
    label: 'admin.content.tables.locations',
    titleField: 'name',
    orderBy: 'name',
    listFields: ['name', 'park_id', 'kind', 'coords_verified', 'is_published'],
    writePermission: 'content.edit',
    fields: [
      { name: 'park_id', type: 'fk', ref: 'parks', required: true },
      { name: 'area_id', type: 'fk', ref: 'themed_areas' },
      { name: 'kind', type: 'select', options: ['attraction', 'restaurant', 'shop', 'show', 'service', 'toilet', 'first_aid', 'entrance', 'other'], required: true },
      { name: 'name', type: 'text', required: true, max: 120 },
      { name: 'latitude', type: 'decimal', min: -90, max: 90, sensitive: true },
      { name: 'longitude', type: 'decimal', min: -180, max: 180, sensitive: true },
      { name: 'coords_verified', type: 'boolean', sensitive: true },
      { name: 'coords_source', type: 'text', max: 300 },
      { name: 'description_i18n', type: 'i18n' },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  announcements: {
    table: 'announcements',
    label: 'admin.content.tables.announcements',
    titleField: 'title_i18n',
    orderBy: 'starts_at',
    listFields: ['title_i18n', 'kind', 'severity', 'starts_at', 'is_published'],
    writePermission: 'content.feature',
    fields: [
      { name: 'park_id', type: 'fk', ref: 'parks' },
      { name: 'attraction_id', type: 'fk', ref: 'attractions' },
      { name: 'kind', type: 'select', options: ['news', 'notice', 'incident'], required: true },
      { name: 'severity', type: 'select', options: ['info', 'warning', 'critical'], required: true },
      { name: 'title_i18n', type: 'i18n', required: true },
      { name: 'body_i18n', type: 'i18nLong' },
      { name: 'starts_at', type: 'datetime', required: true },
      { name: 'ends_at', type: 'datetime' },
      SOURCE,
      ORIGIN,
      PUBLISHED,
    ],
  },
  featured_items: {
    table: 'featured_items',
    label: 'admin.content.tables.featured_items',
    titleField: 'title_i18n',
    orderBy: 'sort_order',
    listFields: ['title_i18n', 'target_kind', 'section', 'is_published'],
    writePermission: 'content.feature',
    fields: [
      { name: 'target_kind', type: 'select', options: ['attraction', 'show', 'restaurant', 'park', 'area', 'announcement', 'post', 'forum_topic', 'url'], required: true },
      { name: 'target_id', type: 'text', max: 36 },
      { name: 'target_url', type: 'url' },
      { name: 'title_i18n', type: 'i18n', required: true },
      { name: 'subtitle_i18n', type: 'i18n' },
      { name: 'section', type: 'select', options: ['discover', 'news', 'community', 'recommendation'], required: true },
      { name: 'accent_color', type: 'color' },
      { name: 'sort_order', type: 'number', min: 0, max: 1000, defaultValue: 0 },
      { name: 'starts_at', type: 'datetime', required: true },
      { name: 'ends_at', type: 'datetime' },
      ORIGIN,
      PUBLISHED,
    ],
  },
};

export function isContentTable(v: string): v is ContentTable {
  return (CONTENT_TABLES as readonly string[]).includes(v);
}

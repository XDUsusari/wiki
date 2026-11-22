/**
 * Row types mirroring the PostgreSQL schema in supabase/migrations.
 * Keep in sync with the migrations (the SQL is the source of truth).
 */

export type Locale = 'ca' | 'es' | 'en';
export type I18nText = Partial<Record<Locale, string>>;

export type AppRole =
  | 'superadmin'
  | 'admin'
  | 'content_manager'
  | 'moderator'
  | 'editor'
  | 'verified_user'
  | 'user';

export type DataOrigin = 'verified' | 'pending_verification' | 'demo' | 'community';
export type OperationalStatus = 'open' | 'temporarily_closed' | 'permanently_closed' | 'unknown';
export type InfoSource = 'official' | 'admin' | 'community' | 'estimate';
export type ModerationStatus = 'visible' | 'pending_review' | 'hidden' | 'removed';
export type IntensityLevel = 'low' | 'moderate' | 'high' | 'extreme';
export type PoiKind =
  | 'attraction'
  | 'restaurant'
  | 'shop'
  | 'show'
  | 'service'
  | 'toilet'
  | 'first_aid'
  | 'entrance'
  | 'other';
export type WaitReportStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'expired';
export type PostCategory =
  | 'news'
  | 'experiences'
  | 'attractions'
  | 'photos'
  | 'collecting'
  | 'history'
  | 'events'
  | 'debates'
  | 'trivia';
export type ReactionKind = 'like' | 'love' | 'wow' | 'fun';
export type NotificationType =
  | 'follow'
  | 'reaction'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'forum_reply'
  | 'news'
  | 'moderation'
  | 'plan'
  | 'park_info'
  | 'achievement'
  | 'badge'
  | 'report_resolved';
export type ReportTarget =
  | 'post'
  | 'comment'
  | 'post_image'
  | 'forum_topic'
  | 'forum_reply'
  | 'review'
  | 'profile'
  | 'attraction_info'
  | 'park_info'
  | 'wait_report';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'inappropriate'
  | 'violence'
  | 'misinformation'
  | 'copyright'
  | 'privacy'
  | 'incorrect_info'
  | 'other';
export type ReportState = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type AttractionType =
  | 'roller_coaster'
  | 'water_ride'
  | 'drop_tower'
  | 'flat_ride'
  | 'family'
  | 'kids'
  | 'dark_ride'
  | 'simulator'
  | 'slide'
  | 'pool'
  | 'walkthrough'
  | 'other';

interface VerifiableRow {
  data_origin: DataOrigin;
  source_url: string | null;
  verified_at: string | null;
  verified_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Park extends VerifiableRow {
  id: string;
  slug: string;
  name: string;
  kind: 'theme_park' | 'water_park';
  accent_color: string;
  tagline_i18n: I18nText;
  description_i18n: I18nText;
  season_i18n: I18nText;
  official_url: string | null;
  hero_image_path: string | null;
  image_credit: string | null;
  sort_order: number;
}

export interface ThemedArea extends VerifiableRow {
  id: string;
  park_id: string;
  slug: string;
  name: string;
  accent_color: string;
  description_i18n: I18nText;
  hero_image_path: string | null;
  image_credit: string | null;
  sort_order: number;
}

export interface LocationRow extends VerifiableRow {
  id: string;
  park_id: string;
  area_id: string | null;
  kind: PoiKind;
  name: string;
  latitude: number | null;
  longitude: number | null;
  coords_verified: boolean;
  coords_source: string | null;
  description_i18n: I18nText;
}

export interface Attraction extends VerifiableRow {
  id: string;
  park_id: string;
  area_id: string | null;
  location_id: string | null;
  slug: string;
  name: string;
  attraction_type: AttractionType;
  intensity: IntensityLevel | null;
  description_i18n: I18nText;
  min_height_cm: number | null;
  min_height_accompanied_cm: number | null;
  max_height_cm: number | null;
  duration_seconds: number | null;
  restrictions_i18n: I18nText;
  accessibility_i18n: I18nText;
  opened_year: number | null;
  hero_image_path: string | null;
  image_credit: string | null;
  image_license: string | null;
  rating_avg: number;
  rating_count: number;
  sort_order: number;
}

interface VenueRow extends VerifiableRow {
  id: string;
  park_id: string;
  area_id: string | null;
  location_id: string | null;
  slug: string;
  name: string;
  description_i18n: I18nText;
  hero_image_path?: string | null;
  image_credit?: string | null;
}

export interface Restaurant extends VenueRow {
  cuisine: string | null;
  service_type: 'table' | 'buffet' | 'quick' | 'snack' | 'other';
  price_range: number | null;
  dietary_i18n: I18nText;
}
export type Shop = VenueRow;
export interface Show extends VenueRow {
  duration_seconds: number | null;
  season_i18n: I18nText;
}
export interface ShowSession extends Omit<VerifiableRow, 'updated_at'> {
  id: string;
  show_id: string;
  session_date: string;
  starts_at: string;
}
export interface ParkService extends VenueRow {
  service_type: string;
}

export interface ParkSchedule extends VerifiableRow {
  id: string;
  park_id: string;
  schedule_date: string;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  note_i18n: I18nText;
}

export interface Announcement extends Omit<VerifiableRow, 'source_url'> {
  id: string;
  park_id: string | null;
  attraction_id: string | null;
  kind: 'news' | 'notice' | 'incident';
  severity: 'info' | 'warning' | 'critical';
  title_i18n: I18nText;
  body_i18n: I18nText;
  source_url: string | null;
  starts_at: string;
  ends_at: string | null;
}

export interface FeaturedItem {
  id: string;
  target_kind: 'attraction' | 'show' | 'restaurant' | 'park' | 'area' | 'announcement' | 'post' | 'forum_topic' | 'url';
  target_id: string | null;
  target_url: string | null;
  title_i18n: I18nText;
  subtitle_i18n: I18nText;
  section: 'discover' | 'news' | 'community' | 'recommendation';
  accent_color: string | null;
  sort_order: number;
  data_origin: DataOrigin;
}

export interface AttractionLiveStatus {
  attraction_id: string;
  park_id: string;
  area_id: string | null;
  status: OperationalStatus;
  status_note_i18n: I18nText | null;
  status_source: InfoSource | null;
  status_updated_at: string | null;
  wait_minutes: number | null;
  wait_source: InfoSource | null;
  wait_reliability: number | null;
  wait_sample_size: number | null;
  wait_updated_at: string | null;
  wait_valid_until: string | null;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  bio: string | null;
  favourite_park_slug: string | null;
  show_favorites: boolean;
  show_stats: boolean;
  xp: number;
  level: number;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  locale: Locale;
  theme: 'system' | 'light' | 'dark';
  onboarding_completed: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  push_enabled: boolean;
  social: boolean;
  replies: boolean;
  mentions: boolean;
  news: boolean;
  park_info: boolean;
  plans: boolean;
  achievements: boolean;
}

export interface Itinerary {
  id: string;
  user_id: string;
  title: string;
  visit_date: string | null;
  party_size: number;
  park_ids: string[];
  notes: string | null;
  preferences: Record<string, unknown>;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ItineraryItemKind = 'attraction' | 'show' | 'restaurant' | 'custom';
export type ItemPriority = 'must' | 'want' | 'maybe';

export interface ItineraryItem {
  id: string;
  itinerary_id: string;
  item_kind: ItineraryItemKind;
  attraction_id: string | null;
  show_id: string | null;
  restaurant_id: string | null;
  custom_title: string | null;
  priority: ItemPriority;
  position: number;
  planned_time: string | null;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  client_id: string | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  attraction_id: string | null;
  show_id: string | null;
  restaurant_id: string | null;
  shop_id: string | null;
  created_at: string;
}

export interface AttractionReview {
  id: string;
  attraction_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  category: PostCategory;
  body: string;
  park_id: string | null;
  attraction_id: string | null;
  moderation_status: ModerationStatus;
  is_featured: boolean;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  edited_at: string | null;
}

export interface PostImage {
  id: string;
  post_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  position: number;
  moderation_status: ModerationStatus;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  moderation_status: ModerationStatus;
  created_at: string;
  edited_at: string | null;
}

export interface ForumCategory {
  id: string;
  slug: string;
  name_i18n: I18nText;
  description_i18n: I18nText;
  icon: string;
  park_id: string | null;
  sort_order: number;
  is_locked: boolean;
  topic_count: number;
}

export interface ForumTopic {
  id: string;
  category_id: string;
  author_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  moderation_status: ModerationStatus;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  edited_at: string | null;
}

export interface ForumReply {
  id: string;
  topic_id: string;
  author_id: string;
  quoted_reply_id: string | null;
  body: string;
  moderation_status: ModerationStatus;
  created_at: string;
  edited_at: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  slug: string;
  name_i18n: I18nText;
  description_i18n: I18nText;
  icon: string;
  color: string;
  is_manual: boolean;
}

export interface Achievement {
  id: string;
  slug: string;
  name_i18n: I18nText;
  description_i18n: I18nText;
  icon: string;
  metric: string;
  threshold: number;
  xp_reward: number;
  is_challenge: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  progress: number;
  unlocked_at: string | null;
}

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  state: ReportState;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface WaitTimeReport {
  id: string;
  attraction_id: string;
  user_id: string;
  minutes: number;
  observed_at: string;
  status: WaitReportStatus;
  is_anomalous: boolean;
  anomaly_reason: string | null;
  expires_at: string;
  created_at: string;
}

export interface SearchResult {
  kind: 'park' | 'area' | 'attraction' | 'restaurant' | 'shop' | 'show' | 'user' | 'post' | 'forum_topic';
  id: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  park_slug: string | null;
  score: number;
}

export interface DashboardStats {
  users_total: number;
  users_new_7d: number;
  users_active_7d: number;
  users_suspended: number;
  posts_total: number;
  posts_7d: number;
  comments_total: number;
  forum_topics_total: number;
  forum_replies_total: number;
  reports_open: number;
  pending_review_items: number;
  attractions_total: number;
  attractions_published: number;
  attractions_pending_verification: number;
  wait_reports_24h: number;
  wait_reports_flagged: number;
  stale_schedules: number;
  activity_14d: { day: string; posts: number; replies: number; reports: number }[];
}

export interface AdminUserRow {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  roles: AppRole[];
  suspended_until: string | null;
  posts_count: number;
  xp: number;
}

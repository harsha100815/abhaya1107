CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE role AS ENUM ('USER','CONTACT','ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE emergency_state AS ENUM ('CREATED','COUNTDOWN','ACTIVE','ACKNOWLEDGED','RESOLVED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE emergency_source AS ENUM ('SOS','SILENT_SOS','TIMER','JOURNEY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE journey_state AS ENUM ('PLANNED','ACTIVE','OVERDUE','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE timer_state AS ENUM ('RUNNING','GRACE','CONFIRMED','ESCALATED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_state AS ENUM ('PENDING','PARTIAL','DELIVERED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_status AS ENUM ('QUEUED','SENT','DELIVERED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE channel AS ENUM ('PUSH','SMS','EMAIL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE evidence_type AS ENUM ('AUDIO','VIDEO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE evidence_status AS ENUM ('UPLOADING','READY','FAILED','DELETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resource_type AS ENUM ('POLICE','HOSPITAL','PHARMACY','SHELTER','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL, email text NOT NULL UNIQUE,
  phone text NOT NULL UNIQUE, password_hash text NOT NULL, role role NOT NULL DEFAULT 'USER', avatar text,
  city text, settings jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL, platform text NOT NULL, push_token text, last_seen_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices(user_id);
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE, user_agent text, ip_address text, expires_at timestamptz NOT NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx ON sessions(user_id, expires_at);
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, phone text NOT NULL, email text, relationship text NOT NULL, verified boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 1, receives jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trusted_contacts_owner_idx ON trusted_contacts(owner_id, priority);
CREATE TABLE IF NOT EXISTS contact_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id uuid, token_hash text NOT NULL UNIQUE, email text, phone text, status text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_invites_owner_idx ON contact_invitations(owner_id, status);
CREATE TABLE IF NOT EXISTS emergency_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status emergency_state NOT NULL, source emergency_source NOT NULL, latitude numeric(10,7), longitude numeric(10,7),
  accuracy numeric(10,2), last_location_at timestamptz, share_token_hash text, share_expires_at timestamptz, share_revoked_at timestamptz,
  delivery_state delivery_state NOT NULL, activated_at timestamptz, resolved_at timestamptz, note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emergency_status_idx ON emergency_events(status, created_at);
CREATE INDEX IF NOT EXISTS emergency_user_status_idx ON emergency_events(user_id, status);
CREATE INDEX IF NOT EXISTS emergency_share_idx ON emergency_events(share_token_hash);
CREATE TABLE IF NOT EXISTS emergency_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), emergency_id uuid NOT NULL REFERENCES emergency_events(id) ON DELETE CASCADE,
  from_status emergency_state, to_status emergency_state NOT NULL, actor_id uuid, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emergency_history_idx ON emergency_status_history(emergency_id, created_at);
CREATE TABLE IF NOT EXISTS safety_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL, origin text NOT NULL, destination text NOT NULL, expected_arrival timestamptz NOT NULL,
  status journey_state NOT NULL, progress numeric(5,2) NOT NULL DEFAULT 0, distance_remaining_km numeric(8,2), eta text,
  contact_ids jsonb NOT NULL DEFAULT '[]'::jsonb, location_session_id text NOT NULL UNIQUE, anomaly jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS journeys_user_status_idx ON safety_journeys(user_id, status);
CREATE INDEX IF NOT EXISTS journeys_status_eta_idx ON safety_journeys(status, expected_arrival);
CREATE TABLE IF NOT EXISTS journey_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journey_id uuid NOT NULL REFERENCES safety_journeys(id) ON DELETE CASCADE,
  latitude numeric(10,7) NOT NULL, longitude numeric(10,7) NOT NULL, accuracy numeric(10,2), speed numeric(8,2), heading numeric(8,2), recorded_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS journey_locations_idx ON journey_locations(journey_id, recorded_at);
CREATE TABLE IF NOT EXISTS journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journey_id uuid NOT NULL REFERENCES safety_journeys(id) ON DELETE CASCADE,
  type text NOT NULL, payload jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journey_events_idx ON journey_events(journey_id, created_at);
CREATE TABLE IF NOT EXISTS safety_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL, duration_minutes integer NOT NULL, expires_at timestamptz NOT NULL, grace_until timestamptz,
  status timer_state NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS timers_user_status_idx ON safety_timers(user_id, status);
CREATE INDEX IF NOT EXISTS timers_status_expiry_idx ON safety_timers(status, expires_at);
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emergency_id uuid, journey_id uuid, timer_id uuid, message text, latitude numeric(10,7), longitude numeric(10,7), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkins_user_time_idx ON check_ins(user_id, created_at);
CREATE TABLE IF NOT EXISTS evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, emergency_id uuid,
  type evidence_type NOT NULL, file_name text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL, storage_key text,
  status evidence_status NOT NULL, retention_until timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_user_time_idx ON evidence_files(user_id, created_at);
CREATE INDEX IF NOT EXISTS evidence_retention_idx ON evidence_files(retention_until);
CREATE TABLE IF NOT EXISTS emergency_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emergency_id uuid, journey_id uuid, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_lookup_idx ON emergency_share_links(token_hash, expires_at);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE CASCADE, recipient_id text,
  type text NOT NULL, title text NOT NULL, body text NOT NULL, channel channel NOT NULL, status notification_status NOT NULL,
  related_type text, related_id text, error text, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_time_idx ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_status_time_idx ON notifications(status, created_at);
CREATE TABLE IF NOT EXISTS safety_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, type resource_type NOT NULL, address text NOT NULL,
  phone text, latitude numeric(10,7) NOT NULL, longitude numeric(10,7) NOT NULL, verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_type_idx ON safety_resources(type, verified);
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid, type text NOT NULL, status text NOT NULL, description text NOT NULL, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, entity_type text NOT NULL,
  entity_id text, ip_address text, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_actor_time_idx ON audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs(entity_type, entity_id);

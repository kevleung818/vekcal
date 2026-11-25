create table if not exists users (
  id text primary key,
  email text,
  phone text,
  password_hash text not null,
  display_name text not null default '',
  gender_identity text,
  privacy_consented_at text,
  email_verified integer not null default 0,
  phone_verified integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((email is not null) <> (phone is not null))
);

create unique index if not exists users_email_lower_idx on users (lower(email)) where email is not null;
create unique index if not exists users_phone_idx on users (phone) where phone is not null;

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists sessions_user_expiry_idx on sessions (user_id, expires_at);

create table if not exists verification_challenges (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('signup', 'password-reset')),
  code_hash text not null,
  expires_at text not null,
  attempts integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists verification_challenges_lookup_idx
  on verification_challenges (user_id, purpose, created_at desc);

create table if not exists readings (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  service text not null check (service in ('numerology', 'iching', 'pentagon', 'sequence')),
  locale text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  result text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists readings_user_created_idx on readings (user_id, created_at desc);

create table if not exists payments (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  reading_id text not null unique references readings(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount integer not null check (amount > 0),
  currency text not null,
  product text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  paid_at text
);

create index if not exists payments_user_created_idx on payments (user_id, created_at desc);

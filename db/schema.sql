create table if not exists users (
  id text primary key,
  email text,
  phone text,
  password_hash text not null,
  display_name text not null default '',
  gender_identity text,
  privacy_consented_at timestamptz,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  check ((email is not null) <> (phone is not null))
);

alter table users add column if not exists privacy_consented_at timestamptz;

create unique index if not exists users_email_lower_idx on users (lower(email)) where email is not null;
create unique index if not exists users_phone_idx on users (phone) where phone is not null;

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_expiry_idx on sessions (user_id, expires_at);

create table if not exists verification_challenges (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('signup', 'password-reset')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists verification_challenges_lookup_idx
  on verification_challenges (user_id, purpose, created_at desc);

create table if not exists readings (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  service text not null check (service in ('numerology', 'iching')),
  locale text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  result jsonb not null,
  created_at timestamptz not null default now()
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
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_user_created_idx on payments (user_id, created_at desc);

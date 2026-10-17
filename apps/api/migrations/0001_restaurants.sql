create table restaurants (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  place_id text unique,
  created_at timestamptz not null default now(),
  constraint restaurants_provider_has_place
    check (source = 'provider' and place_id is not null)
);

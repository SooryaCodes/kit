-- what a buyer asks before ordering from a small shop: where it is, delivery, cash on delivery, returns
alter table public.pages
  add column about text check (about is null or char_length(about) <= 140),
  add column city text check (city is null or char_length(city) <= 40),
  add column delivery_note text check (delivery_note is null or char_length(delivery_note) <= 80),
  add column returns_note text check (returns_note is null or char_length(returns_note) <= 80),
  add column cod boolean not null default false;

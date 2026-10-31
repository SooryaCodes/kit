-- How a product is placed in a room: lying flat (photographed from above) or standing up (photographed from the front).
alter table public.items add column ar_pose text check (ar_pose is null or ar_pose in ('flat', 'upright'));

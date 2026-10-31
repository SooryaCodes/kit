-- for the product catalog feed: a Google product category id, and a plain product photo for shops without a styled one
alter table public.items
  add column product_category integer,
  add column catalog_image_path text;

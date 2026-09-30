-- TECHNOROOM: photo for catalogue categories.
-- Run once in Supabase SQL Editor before uploading category images in the admin panel.

alter table public.categories
  add column if not exists image_path text;


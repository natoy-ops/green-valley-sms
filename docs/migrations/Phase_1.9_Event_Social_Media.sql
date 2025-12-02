-- Phase 1.9 - Event Social Media Sharing Support
--
-- Adds a poster_image_url column to the events table to store
-- event poster/banner images for social media sharing.
-- The existing description field will be used for social media post text.

-----------------------------
-- 1. Add poster_image_url column
-----------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS poster_image_url text NULL;

COMMENT ON COLUMN public.events.poster_image_url IS 'URL to the event poster/banner image for social media sharing and public display.';
COMMENT ON COLUMN public.events.description IS 'Event description text, also used for social media post captions when sharing.';

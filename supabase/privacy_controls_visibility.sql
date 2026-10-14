-- StudentHub privacy controls visibility
-- The three booleans are intended to govern what classmates can see/do.
-- This allows authenticated classmates to read those controls so the app can
-- honor profile-picture, online-status, and direct-message preferences.
-- It does not grant INSERT, UPDATE, or DELETE access to another user's settings.

ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read privacy controls"
ON public.privacy_settings;

CREATE POLICY "Authenticated users can read privacy controls"
ON public.privacy_settings
FOR SELECT
TO authenticated
USING (true);

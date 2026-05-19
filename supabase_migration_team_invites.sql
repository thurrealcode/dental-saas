-- Run this in the Supabase SQL Editor
-- Creates the team_invites table for link-based team invitations

CREATE TABLE IF NOT EXISTS public.team_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('admin', 'dentist', 'receptionist')),
  token       text        NOT NULL UNIQUE,
  created_by  uuid        NOT NULL REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast token lookup (used on every invite accept)
CREATE INDEX IF NOT EXISTS team_invites_token_idx ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS team_invites_company_idx ON public.team_invites(company_id);

-- Simple RLS: service role bypasses automatically; anon/authenticated won't need direct access
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Members can see invites for their company
CREATE POLICY "members can view company invites"
  ON public.team_invites FOR SELECT
  USING (public.is_member_of(company_id));

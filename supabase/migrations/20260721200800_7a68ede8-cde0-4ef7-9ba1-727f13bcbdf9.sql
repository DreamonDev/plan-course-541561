-- Single-row shared state table for the grocery app
CREATE TABLE public.app_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO authenticated;
GRANT ALL ON public.app_state TO service_role;

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to app state"
  ON public.app_state FOR SELECT
  USING (true);

CREATE POLICY "Public insert access to app state"
  ON public.app_state FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access to app state"
  ON public.app_state FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Seed the single row
INSERT INTO public.app_state (id, data) VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable realtime for cross-device live sync
ALTER TABLE public.app_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;
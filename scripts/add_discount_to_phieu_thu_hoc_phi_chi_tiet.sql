-- Add discount column to phieu_thu_hoc_phi_chi_tiet if missing
ALTER TABLE public.phieu_thu_hoc_phi_chi_tiet
ADD COLUMN IF NOT EXISTS discount NUMERIC(12, 2) DEFAULT 0;

-- Optional: backfill existing rows where discount is null
UPDATE public.phieu_thu_hoc_phi_chi_tiet
SET discount = 0
WHERE discount IS NULL;

-- Refresh PostgREST schema cache (run in Supabase SQL editor)
NOTIFY pgrst, 'reload schema';

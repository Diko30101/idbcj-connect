-- Migration 034: idagdag ang signature column sa tulong_loan_requests
-- Para sa electronic signature ng nanghihiram bilang katunayan ng pananagutan.
-- Ang signature ay naka-store bilang base64 data URL (PNG mula sa canvas).

alter table public.tulong_loan_requests
  add column if not exists signature text;

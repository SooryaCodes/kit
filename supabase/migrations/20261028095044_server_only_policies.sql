-- Make the server-only tables explicit: anon and authenticated are denied everything.
-- (RLS with no policies already denies; these policies document the intent and keep the linter quiet.)

create policy "server only" on public.model_cache as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.api_spend as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.job_requests as restrictive for all to anon, authenticated using (false) with check (false);

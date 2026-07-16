-- ============================================================================
-- Halkora — Kurucu ayarları (Faz 3C madde 3)
-- SQL Editor'de çalıştır. Deploy gerektirmiyor (RPC), webhook gerektirmiyor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- update_challenge_details — yalnızca KURUCU çağırabilir (owner_id kontrolü).
-- Bilinçli olarak dar tutuldu: yalnızca başlık, günlük eylem, bahis metni
-- değişebilir. Gün sayısı / joker / başlangıç tarihi / katılım penceresi bu
-- RPC'nin KAPSAMI DIŞINDA — onlar geçmiş check-in'lerin anlamını/adaleti
-- değiştirir (grup 10 gün koştuktan sonra 30 günü 15'e çekmek gibi), bu
-- yüzden hiçbir yoldan düzenlenebilir olmamalılar (Ek G'deki restart/endEarly
-- RPC'lerinin dar tutulma gerekçesiyle aynı).
--
-- Bahis metni boş bırakılırsa mevcut bahis silinir; hiç bahis yokken bir
-- metin girilirse yeni bir bahis (mode='direct') oluşturulur; ikisinin
-- ortasında (mevcut bahsin sadece metni) güncellenir.
-- ============================================================================
create or replace function public.update_challenge_details(
  p_challenge_id uuid,
  p_title text,
  p_daily_action text,
  p_stake_text text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_title text := trim(p_title);
  v_action text := trim(p_daily_action);
  v_stake text := nullif(trim(coalesce(p_stake_text, '')), '');
begin
  if not exists (
    select 1 from challenges where id = p_challenge_id and owner_id = auth.uid()
  ) then
    raise exception 'NOT_THE_OWNER';
  end if;
  if v_title = '' then
    raise exception 'TITLE_REQUIRED';
  end if;
  if v_action = '' then
    raise exception 'DAILY_ACTION_REQUIRED';
  end if;

  update challenges set title = v_title, daily_action = v_action where id = p_challenge_id;

  if v_stake is null then
    delete from stakes where challenge_id = p_challenge_id;
  elsif exists (select 1 from stakes where challenge_id = p_challenge_id) then
    update stakes set text = v_stake where challenge_id = p_challenge_id;
  else
    insert into stakes (challenge_id, mode, text) values (p_challenge_id, 'direct', v_stake);
  end if;
end;
$$;
grant execute on function public.update_challenge_details(uuid, text, text, text) to authenticated;

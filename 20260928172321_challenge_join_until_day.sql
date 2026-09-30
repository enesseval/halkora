-- Halkaya katılımı belirli bir günün sonunda kapatma (ör. 14 günlük halkada 7. gün).
-- null = sınır yok (mevcut davranış). first_day_join_only ile birlikte çalışır.
alter table public.challenges add column if not exists join_until_day integer;
alter table public.challenges add constraint challenges_join_until_day_check
  check (join_until_day is null or join_until_day >= 1);
comment on column public.challenges.join_until_day is
  'Katılım bu günün sonunda kapanır (1 = yalnızca ilk gün). null = sınır yok.';

CREATE OR REPLACE FUNCTION public.join_challenge_by_code(p_code text, p_system_text text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ch     challenges%rowtype;
  v_restrict boolean;
  v_current_day int;
  v_joined boolean := false;
  v_day    int;
begin
  select * into v_ch from challenges where invite_code = p_code;
  if v_ch.id is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  -- Kapanmış, erken bitirilmiş VE takvimle bitmiş halkaların hepsi kapalı.
  if public.challenge_is_over(v_ch) then
    raise exception 'CHALLENGE_CLOSED';
  end if;

  v_restrict := v_ch.first_day_join_only;
  if v_restrict and v_ch.start_date is not null then
    v_current_day := ((now() at time zone v_ch.timezone)::date - v_ch.start_date) + 1;
    if v_current_day > 1 then
      raise exception 'JOIN_WINDOW_CLOSED';
    end if;
  end if;

  -- Katılım penceresi: join_until_day. gününün sonunda kapanır.
  if v_ch.join_until_day is not null and v_ch.start_date is not null then
    v_current_day := ((now() at time zone v_ch.timezone)::date - v_ch.start_date) + 1;
    if v_current_day > v_ch.join_until_day then
      raise exception 'JOIN_WINDOW_CLOSED';
    end if;
  end if;

  insert into participants (challenge_id, user_id)
  values (v_ch.id, auth.uid())
  on conflict (challenge_id, user_id) do nothing;

  get diagnostics v_joined = row_count;

  -- Only on a real join. Opening your own invite link again must not announce
  -- you a second time.
  if v_joined and p_system_text is not null then
    select coalesce(max(day_number), 0) into v_day
      from messages where challenge_id = v_ch.id;
    insert into messages (challenge_id, user_id, day_number, kind, text, notify_others)
    values (v_ch.id, auth.uid(), v_day, 'system', p_system_text, false);
  end if;

  return v_ch.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_challenge_preview(p_code text)
 RETURNS TABLE(id uuid, title text, daily_action text, total_days integer, start_date date, status text, stake_text text, participant_count integer, sample_names text[], join_closed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id, c.title, c.daily_action, c.total_days, c.start_date,
    case when public.challenge_is_over(c) then 'completed' else c.status end as status,
    (select s.text from stakes s where s.challenge_id = c.id limit 1) as stake_text,
    (select count(*)::int from participants p where p.challenge_id = c.id) as participant_count,
    (select array_agg(pr.name order by p.joined_at)
       from participants p join profiles pr on pr.id = p.user_id
       where p.challenge_id = c.id limit 5) as sample_names,
    (c.start_date is not null and (
       (c.first_day_join_only
          and ((now() at time zone c.timezone)::date - c.start_date) + 1 > 1)
       or (c.join_until_day is not null
          and ((now() at time zone c.timezone)::date - c.start_date) + 1 > c.join_until_day)
    )) as join_closed
  from challenges c
  where c.invite_code = p_code
  limit 1;
$function$;

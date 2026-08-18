-- ============================================================================
-- 20260818_world_shop_server_authority.sql
--
-- 상점에서 산 것 · 입은 것 · 방에 놓은 것을 서버에 남깁니다.
-- 이 저장소의 Supabase 프로젝트에 **이미 적용돼 있습니다.**
--
-- 왜 필요했나
-- -----------
-- 지금까지 ROOM.owned · ROOM.worn · ROOM.decor · ROOM.tint 는 localStorage
-- 에만 있었습니다. 기기를 바꾸면 800코인짜리 알이 사라집니다. 그리고
-- index.html 의 spend() 에는 이런 주석이 달려 있었습니다:
--
--   ponytail: 서버에는 아직 소비 RPC 가 없어 잔액 차감이 로컬입니다.
--             상점을 실서버에 붙일 때 world_spend 를 만들어 여기서 부릅니다.
--
-- 그 자리를 채웁니다.
--
-- 왜 값을 서버가 정하는가 — 이 파일에서 제일 중요한 줄
-- ---------------------------------------------------
-- 코인은 이미 서버가 지급합니다(world__grant). 그런데 **쓰는 쪽이 로컬**이면
-- 장부가 반쪽입니다. 브라우저 콘솔에서 ROOM.owned.push('egg-swan') 한 줄이면
-- 800코인짜리를 공짜로 얻습니다. 그래서
--
--   · 값은 world_shop_items 에 있습니다. 클라이언트가 보내는 것은 **item_id
--     하나**뿐이고 금액은 아예 안 받습니다 — 못 받는 인자는 못 속입니다.
--   · 잔액 확인과 차감과 보유 등록이 한 함수 안에서 끝납니다. plpgsql 함수
--     하나가 곧 한 트랜잭션이라, 중간에 끊기면 셋 다 없던 일이 됩니다.
--   · world_coins 는 예전 그대로 쓰기 정책이 없습니다. REST 로 잔액을 직접
--     PATCH 하면 403 입니다. 새 표 셋도 같은 규칙입니다.
--
-- 값이 index.html 의 SHOP 과 어긋나면 어떻게 되나
-- ----------------------------------------------
-- 화면은 220 이라 적어 놓고 서버는 250 을 빼 갈 수 있습니다. 그래서
-- world_room_state() 가 값표를 같이 돌려주고, 클라이언트가 그 값으로 화면을
-- 덮어씁니다. 값표는 한 벌이고 그 한 벌은 서버 것입니다.
-- **아래 seed 를 고칠 때 index.html 의 SHOP.price 도 같이 고치세요** —
-- 반대로 어긋나면 화면만 잠깐 틀리고, 실제로 빠지는 액수는 여기 값입니다.
--
-- 인자 목록 규칙
-- --------------
-- 20260816_chair_minutes_rpc.sql 이 겪은 일을 되풀이하지 않습니다. 나중에
-- 값을 하나 더 받아야 하면 **마지막에 기본값을 달아** 붙입니다. 그래야 이미
-- 배포된 index.html 이 그대로 돕니다. 되도록 새 인자 대신 world_room_state()
-- 의 반환 jsonb 에 열쇠를 더하는 쪽을 쓰세요 — jsonb 는 늘어나도 옛 클라이언트가
-- 안 깨집니다.
-- ============================================================================

-- ---------------- 1. 값표 ----------------
-- 왜 표인가: 함수 안에 case 문으로 박으면 값을 고칠 때마다 함수를 다시
-- 만들어야 하고, 그러면 grant/revoke 를 매번 다시 걸어야 합니다.

create table if not exists public.world_shop_items (
  item_id           text primary key,
  cat               text not null,
  price             integer not null check (price >= 0),
  -- 알만 채웁니다. 알을 사면 캐릭터가 그 종으로 바뀌는데, 어떤 알이 어떤
  -- 종인지를 서버도 알아야 "안 산 종으로 바꾸기" 를 막을 수 있습니다.
  grants_character  text,
  -- 상품을 내릴 때 지웁니다. 지우면 이미 산 사람의 보유 행이 같이 날아갑니다.
  active            boolean not null default true
);

comment on table public.world_shop_items is
  '상점 값표. 값을 정하는 곳은 여기 한 곳뿐입니다 — 클라이언트는 item_id 만 보내고 금액은 안 보냅니다.';

insert into public.world_shop_items (item_id, cat, price, grants_character) values
  ('top-varsity',   'top',    220, null),   -- 과잠
  ('top-hoodie',    'top',    150, null),   -- 후드티
  ('top-shirt',     'top',    250, null),   -- 셔츠
  ('top-tee',       'top',    120, null),   -- 반팔티
  ('bot-jeans',     'bottom', 160, null),   -- 청바지
  ('bot-slacks',    'bottom', 200, null),   -- 슬랙스
  ('bot-shorts',    'bottom', 150, null),   -- 반바지
  ('bot-trainer',   'bottom', 140, null),   -- 트레이닝복
  ('sho-sneaker',   'shoes',  150, null),   -- 운동화
  ('sho-dress',     'shoes',  230, null),   -- 구두
  ('sho-slipper',   'shoes',  150, null),   -- 삼선 슬리퍼
  ('hat-cap',       'hat',    100, null),   -- 볼캡
  ('hat-beanie',    'hat',    120, null),   -- 비니
  ('hat-grad',      'hat',    400, null),   -- 학사모
  ('fac-horn',      'face',   200, null),   -- 뿔테
  ('fac-round',     'face',   200, null),   -- 동그란테
  ('fac-sun',       'face',   260, null),   -- 선글라스
  ('bag-backpack',  'bag',    180, null),   -- 백팩
  ('bag-tote',      'bag',    140, null),   -- 에코백
  ('egg-turtle',    'egg',    800, '거북이'),
  ('egg-giraffe',   'egg',    800, '기린'),
  ('egg-penguin',   'egg',    800, '펭귄'),
  ('egg-hamster',   'egg',    800, '햄스터'),
  ('egg-frog',      'egg',    800, '개구리'),
  ('egg-hedgehog',  'egg',    800, '고슴도치'),
  ('egg-alpaca',    'egg',    800, '알파카'),
  ('egg-swan',      'egg',    800, '백조'),
  ('fur-cushion',   'furn',    60, null),   -- 방석
  ('fur-dumbbell',  'furn',    80, null),   -- 아령
  ('fur-plant',     'furn',    90, null),   -- 작은 화분
  ('fur-fan',       'furn',   140, null),   -- 선풍기
  ('fur-shelf',     'furn',   180, null),   -- 낮은 책장
  ('fur-rug-round', 'furn',   190, null),   -- 둥근 러그
  ('fur-guitar',    'furn',   240, null),   -- 기타
  ('fur-beanbag',   'furn',   260, null),   -- 빈백
  ('fur-rug',       'furn',   300, null),   -- 러그
  ('fur-tv',        'furn',   340, null)    -- 브라운관 TV
on conflict (item_id) do update
  set cat = excluded.cat,
      price = excluded.price,
      grants_character = excluded.grants_character,
      active = true;

-- ---------------- 2. 산 것 ----------------
-- 하나씩만 삽니다 — index.html 의 SHOP 주석과 같은 결정입니다("ROOM.owned 가
-- '샀나 안 샀나' 뿐이라 개수를 세려면 장부를 하나 더 만들어야 합니다").
-- 그래서 기본키가 (user_key, item_id) 입니다. 개수 개념이 생기면 여기에
-- qty 를 더하는 것이 아니라 표를 새로 만드세요 — 기본키가 바뀌면 옛 행의
-- 뜻이 바뀝니다.

create table if not exists public.world_owned_items (
  user_key  uuid not null default auth.uid(),
  item_id   text not null references public.world_shop_items(item_id),
  bought_at timestamptz not null default now(),
  price_paid integer not null default 0,     -- 값이 나중에 바뀌어도 얼마에 샀는지는 남습니다
  primary key (user_key, item_id)
);

comment on table public.world_owned_items is
  '산 아이템. 쓰기는 world_buy_item 만 합니다 — REST 로 직접 insert 하는 길이 있으면 공짜로 가질 수 있습니다.';

-- ---------------- 3. 입은 것 ----------------
-- 왜 행이 아니라 jsonb 한 칸인가: worn 은 "칸 하나에 하나" 라 사실상 6칸짜리
-- 고정 레코드입니다. 행으로 풀면 입고 벗을 때마다 delete+insert 가 되는데,
-- 얻는 것이 없습니다. decor 와 다른 이유는 decor 에는 좌표가 붙고 개수가
-- 자라기 때문입니다.

create table if not exists public.world_loadout (
  user_key   uuid primary key,
  worn       jsonb not null default '{}'::jsonb,   -- { top: 'top-tee', ... }
  tint       jsonb not null default '{}'::jsonb,   -- { 'top-tee': '#3A3F4A', ... }
  character  text,                                  -- 종 이름. 알을 사야 바꿀 수 있습니다
  updated_at timestamptz not null default now()
);

comment on table public.world_loadout is
  '입은 것과 고른 색. 안 산 것은 서버가 걸러 냅니다 — 입기는 공짜라도 "안 산 옷을 입은 상태" 를 남기면 그게 곧 보유입니다.';

-- ---------------- 4. 방에 놓은 것 ----------------
-- ROOM.decor 가 [{id,x,y}] 납작한 배열이라 그대로 한 줄씩이 됩니다.
-- index.html 주석: "나중에 서버로 갈 때 그대로 (room_id, item_id, x, y)
-- 한 줄씩이 됩니다." 그 약속을 지킵니다(room 대신 user 로 갑니다 — 이 판본의
-- 기숙사는 사람마다 하나입니다).

create table if not exists public.world_decor (
  user_key uuid not null default auth.uid(),
  item_id  text not null references public.world_shop_items(item_id),
  x        smallint not null check (x between 0 and 63),
  y        smallint not null check (y between 0 and 63),
  primary key (user_key, item_id)
);

comment on table public.world_decor is
  '기숙사 방에 놓은 가구 한 줄씩. 서버는 범위만 봅니다 — 벽에 겹치나·방이 막히나는 지도를 아는 클라이언트가 판정합니다.';

-- ---------------- 5. RLS ----------------
-- world_coins 와 같은 규칙입니다. 읽기는 본인 행만, 쓰기 정책은 아예 안
-- 만듭니다. 값표만 예외로 모두가 읽습니다 — 값은 숨길 것이 아니고, 오히려
-- 클라이언트가 서버 값으로 화면을 맞춰야 하기 때문입니다.

alter table public.world_shop_items  enable row level security;
alter table public.world_owned_items enable row level security;
alter table public.world_loadout     enable row level security;
alter table public.world_decor       enable row level security;

drop policy if exists world_shop_items_select_all on public.world_shop_items;
create policy world_shop_items_select_all on public.world_shop_items
  for select to authenticated
  using (active);

drop policy if exists world_owned_items_select_own on public.world_owned_items;
create policy world_owned_items_select_own on public.world_owned_items
  for select to authenticated
  using (user_key = (select auth.uid()));

drop policy if exists world_loadout_select_own on public.world_loadout;
create policy world_loadout_select_own on public.world_loadout
  for select to authenticated
  using (user_key = (select auth.uid()));

drop policy if exists world_decor_select_own on public.world_decor;
create policy world_decor_select_own on public.world_decor
  for select to authenticated
  using (user_key = (select auth.uid()));

revoke insert, update, delete on public.world_shop_items  from anon, authenticated;
revoke insert, update, delete on public.world_owned_items from anon, authenticated;
revoke insert, update, delete on public.world_loadout     from anon, authenticated;
revoke insert, update, delete on public.world_decor       from anon, authenticated;
revoke all on public.world_shop_items, public.world_owned_items,
              public.world_loadout, public.world_decor from anon;

-- ---------------- 6. 삽니다 ----------------
-- 값 확인 · 잔액 확인 · 차감 · 보유 등록이 한 문 안에서 끝납니다.
--
-- 왜 world__spend 헬퍼를 안 만들었나: 쓰는 길이 지금 이 하나뿐입니다.
-- world__grant 에 헬퍼가 있는 이유는 지급 경로가 셋이라 하루 상한을 셋이
-- 따로 세면 어긋나기 때문이었는데, 소비에는 상한이 없습니다(하루 상한은
-- **버는 쪽에만** 겁니다 — 쓴 액수를 오늘 번 것에서 빼면 상한이 늘어납니다).
-- 두 번째 소비 경로가 생기면 그때 world__spend 로 모으세요.
--
-- balance 컬럼에 check (balance >= 0) 이 걸려 있어서, 여기 검사에 구멍이
-- 나도 데이터베이스가 마지막으로 한 번 더 막습니다.

create or replace function public.world_buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_item  world_shop_items;
  v_bal   integer;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  select * into v_item from world_shop_items where item_id = p_item_id and active;
  if not found then
    -- 없는 id 는 조용히 실패시키지 않습니다. 화면에 없는 물건을 사려는
    -- 요청은 버그거나 장난이고, 둘 다 알아야 합니다.
    return jsonb_build_object('ok', false, 'reason', 'unknownItem',
      'balance', coalesce((select balance from world_coins where user_key = v_uid), 0));
  end if;

  insert into world_coins (user_key) values (v_uid) on conflict (user_key) do nothing;

  -- for update 로 잠급니다. 두 탭에서 동시에 누르면 둘 다 "잔액 충분" 을
  -- 보고 둘 다 빼 갈 수 있습니다.
  select balance into v_bal from world_coins where user_key = v_uid for update;

  if exists (select 1 from world_owned_items where user_key = v_uid and item_id = p_item_id) then
    return jsonb_build_object('ok', false, 'reason', 'already', 'balance', v_bal);
  end if;

  if v_bal < v_item.price then
    return jsonb_build_object('ok', false, 'reason', 'poor',
      'balance', v_bal, 'price', v_item.price);
  end if;

  update world_coins set balance = balance - v_item.price where user_key = v_uid;
  insert into world_owned_items (user_key, item_id, price_paid)
    values (v_uid, p_item_id, v_item.price);

  return jsonb_build_object('ok', true, 'reason', null,
    'itemId', p_item_id, 'price', v_item.price,
    'balance', v_bal - v_item.price);
end;
$$;

revoke all on function public.world_buy_item(text) from public, anon;
grant execute on function public.world_buy_item(text) to authenticated;

-- ---------------- 7. 입습니다 ----------------
-- 통째로 덮습니다. 칸이 여섯뿐이라 부분 갱신을 만들 이유가 없고, 부분
-- 갱신은 "벗기" 를 표현하기 위해 null 을 특별 취급해야 합니다.
--
-- **안 산 것은 서버가 버립니다.** 입기 자체는 공짜지만, 안 산 옷을 입은
-- 상태를 서버가 받아 주면 그게 곧 보유입니다 — 남에게도 그 옷으로 보이고,
-- 다음 접속에도 그대로 돌아옵니다.
-- 거절하지 않고 **버리는** 쪽인 이유: 상품이 하나 내려가면(active=false)
-- 그 옷을 입고 있던 사람의 저장이 통째로 실패하게 됩니다. 걸러 내면
-- 나머지는 저장되고, 화면은 서버가 돌려준 것으로 맞춰집니다.

create or replace function public.world_set_loadout(
  p_worn      jsonb,
  p_tint      jsonb default '{}'::jsonb,
  p_character text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_worn jsonb := '{}'::jsonb;
  v_tint jsonb := '{}'::jsonb;
  v_char text;
  k      text;
  v      text;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  -- worn: 열쇠(칸)와 값(아이템)이 서로 맞고, 그 아이템을 샀을 때만 남깁니다.
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_worn, '{}'::jsonb)) loop
    if exists (
      select 1 from world_owned_items o join world_shop_items s using (item_id)
       where o.user_key = v_uid and o.item_id = v and s.cat = k and s.cat <> 'furn' and s.cat <> 'egg'
    ) then
      v_worn := v_worn || jsonb_build_object(k, v);
    end if;
  end loop;

  -- tint: 산 아이템에 대한 #rrggbb 만.
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_tint, '{}'::jsonb)) loop
    if v ~ '^#[0-9A-Fa-f]{6}$'
       and exists (select 1 from world_owned_items where user_key = v_uid and item_id = k) then
      v_tint := v_tint || jsonb_build_object(k, v);
    end if;
  end loop;

  -- character: 알을 사야 바꿀 수 있습니다. 거북이는 처음부터 주는 종이라
  -- 알 없이도 됩니다 — 안 그러면 알을 산 적 없는 사람이 종을 잃습니다.
  if p_character is null then
    select character into v_char from world_loadout where user_key = v_uid;
  elsif p_character = '거북이' or exists (
    select 1 from world_owned_items o join world_shop_items s using (item_id)
     where o.user_key = v_uid and s.grants_character = p_character
  ) then
    v_char := p_character;
  else
    select character into v_char from world_loadout where user_key = v_uid;
  end if;

  insert into world_loadout (user_key, worn, tint, character, updated_at)
    values (v_uid, v_worn, v_tint, v_char, now())
  on conflict (user_key) do update
    set worn = excluded.worn, tint = excluded.tint,
        character = excluded.character, updated_at = now();

  return jsonb_build_object('worn', v_worn, 'tint', v_tint, 'character', v_char);
end;
$$;

revoke all on function public.world_set_loadout(jsonb, jsonb, text) from public, anon;
grant execute on function public.world_set_loadout(jsonb, jsonb, text) to authenticated;

-- ---------------- 8. 놓습니다 ----------------
-- 목록을 통째로 덮습니다. 가구는 열 개뿐이고, 한 번 옮길 때마다 "무엇이
-- 지워졌나" 를 따지는 것보다 지금 방의 모습을 그대로 보내는 쪽이 짧습니다.
--
-- 서버는 **산 가구인가 · 좌표가 숫자인가**만 봅니다. 벽에 겹치나, 방이
-- 두 조각 나나는 지도를 가진 쪽만 알 수 있는 일입니다(decorCheck).
-- 서버에 지도를 한 벌 더 두면 지도가 두 벌이 되고, 언젠가 어긋납니다.

create or replace function public.world_set_decor(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  delete from world_decor where user_key = v_uid;

  insert into world_decor (user_key, item_id, x, y)
  select v_uid,
         e->>'id',
         least(greatest((e->>'x')::int, 0), 63),
         least(greatest((e->>'y')::int, 0), 63)
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
   where e->>'id' is not null
     and (e->>'x') ~ '^-?\d+$' and (e->>'y') ~ '^-?\d+$'
     and exists (
       select 1 from world_owned_items o join world_shop_items s using (item_id)
        where o.user_key = v_uid and o.item_id = e->>'id' and s.cat = 'furn')
  on conflict (user_key, item_id) do nothing;   -- 같은 가구를 두 번 보내도 한 번만

  select coalesce(jsonb_agg(jsonb_build_object('id', item_id, 'x', x, 'y', y) order by item_id), '[]'::jsonb)
    into v_out from world_decor where user_key = v_uid;
  return v_out;
end;
$$;

revoke all on function public.world_set_decor(jsonb) from public, anon;
grant execute on function public.world_set_decor(jsonb) to authenticated;

-- ---------------- 9. 한 번에 읽습니다 ----------------
-- 접속할 때 표 넷을 따로 물으면 왕복이 넷입니다. 화면이 그려지기 전에
-- 끝나야 하는 값이라 한 문으로 모읍니다.
--
-- prices 를 같이 돌려주는 이유는 위 머리말에 적었습니다 — 화면에 뜨는 값과
-- 실제로 빠지는 값이 다르면 안 됩니다.
--
-- 반환은 jsonb 라 열쇠를 나중에 더해도 옛 클라이언트가 안 깨집니다.

create or replace function public.world_room_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_load world_loadout;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  select * into v_load from world_loadout where user_key = v_uid;

  return jsonb_build_object(
    'balance', coalesce((select balance from world_coins where user_key = v_uid), 0),
    'owned',   coalesce((select jsonb_agg(item_id order by item_id)
                           from world_owned_items where user_key = v_uid), '[]'::jsonb),
    'worn',      coalesce(v_load.worn, '{}'::jsonb),
    'tint',      coalesce(v_load.tint, '{}'::jsonb),
    'character', v_load.character,
    'decor',   coalesce((select jsonb_agg(jsonb_build_object('id', item_id, 'x', x, 'y', y) order by item_id)
                           from world_decor where user_key = v_uid), '[]'::jsonb),
    'prices',  coalesce((select jsonb_object_agg(item_id, price)
                           from world_shop_items where active), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.world_room_state() from public, anon;
grant execute on function public.world_room_state() to authenticated;

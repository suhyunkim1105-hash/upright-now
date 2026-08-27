-- 노션 연결 — 사람마다 자기 워크스페이스.
--
-- 왜 표가 필요한가
--   내부 통합은 토큰 하나라 모든 사람의 녹음이 한 워크스페이스로 갑니다.
--   공개 통합(OAuth)은 사람마다 토큰이 다르므로 어딘가 보관해야 합니다.
--   브라우저(localStorage)에 두면 안 됩니다 — 이 토큰은 그 사람이 승인한
--   노션 범위를 **읽고 쓸 수 있는 열쇠**입니다. XSS 한 번이면 그대로 샙니다.
--
-- 왜 RLS 로 전부 막는가
--   보통은 "자기 행만 읽게" 를 씁니다. 여기서는 **자기 것도 못 읽게** 합니다.
--   클라이언트가 이 표를 읽을 이유가 없기 때문입니다 — 토큰을 쓰는 것은
--   서버 함수뿐이고, 브라우저는 "연결됐나 / 어느 워크스페이스인가" 만
--   알면 됩니다. 그건 /api/notion-oauth 가 답해 줍니다.
--   정책을 하나도 안 만들면 anon·authenticated 는 아무것도 못 합니다.
--   service_role 은 RLS 를 우회하므로 서버 함수만 통과합니다.

create table if not exists public.notion_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  access_token   text        not null,
  refresh_token  text,
  workspace_id   text,
  workspace_name text,
  -- 승인할 때 노션이 템플릿을 복제해 주고 돌려주는 페이지입니다.
  -- 회의록을 여기 밑에 답니다. 없으면(사용자가 기존 페이지를 골랐으면)
  -- 서버가 search 로 쓸 수 있는 페이지를 하나 찾습니다.
  page_id        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.notion_connections enable row level security;
-- 정책 없음이 곧 정책입니다. 위 주석 참고.

comment on table public.notion_connections is
  '노션 OAuth 토큰. service_role 로만 읽습니다 — 클라이언트 정책을 만들지 마세요.';

create or replace function public.touch_notion_connection()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notion_connections_touch on public.notion_connections;
create trigger notion_connections_touch
  before update on public.notion_connections
  for each row execute function public.touch_notion_connection();

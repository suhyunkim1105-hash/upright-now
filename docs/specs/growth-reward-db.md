# 성장·보상 DB 1단계 설계

이 문서는 개인 성장 XP·잎사귀 포인트를 서버에 기록하기 위한 최소 계약이다.
캠퍼스 시즌 점수와 영토 상태는 기존 `campus_*` 테이블·RPC를 사용하며 이 단계에서
혼합하지 않는다.

## 점수 경계

- `progression_balances.xp`: 사용자 성장용 누적 XP. 시즌이 바뀌어도 초기화하지 않는다.
- `progression_balances.points`: 상점·보상용 잎사귀 포인트. 기존 로컬 포인트를 서버로 옮길 때 기준값을 별도로 정한다.
- `progression_reward_events`: 지급 사실의 원장. 합계는 원장 합계와 잔액을 대조할 수 있어야 한다.
- 캠퍼스 기여도·학교 점수·영토 점수는 `campus_contributions`와 기존 캠퍼스 RPC에서 관리한다.

## 이벤트 계약

| event_type | 기본 XP | 기본 포인트 | source_session_id | 비고 |
| --- | ---: | ---: | --- | --- |
| `recovery_success` | 25 | 5 | 필수 | 세션당 상한은 서버에서 추가 |
| `session_completed` | 60 | 30 | 필수 | 길이별 보상은 후속 단계에서 세션 데이터로 계산 |
| `stretch_completed` | 10 | 10 | 필수 | 세션당 1회 정책 검토 |
| `goal_completed` | 15 | 10 | 필수 | 세션당 1회 |
| `friend_session_bonus` | 20 | 10 | 필수 | 친구 방 완주 검증 후 지급 |
| `streak_bonus` | 0 | 0 | 선택 | 마일스톤 정책 확정 후 추가 |

클라이언트는 XP·포인트 숫자를 전송하지 않는다. 클라이언트는 `event_id`, 이벤트 종류,
세션 ID만 보내고, 서버가 지급량을 결정한다. `event_id`는 사용자별 멱등 키다.

## 다음 단계

1. 이 원장과 잔액 migration을 네 개발 Supabase에 적용한다.
2. 기존 `applyReward` 호출을 서버 RPC로 전환한다.
3. 기존 로컬 데이터의 이관 여부를 결정한 뒤 성장 화면을 서버 잔액으로 전환한다.

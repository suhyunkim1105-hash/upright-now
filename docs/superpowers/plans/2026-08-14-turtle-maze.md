# 거북이 미로 탈출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 등껍질 퍼즐 슬롯을 10×10 거북이 미로 탈출 게임으로 교체한다.

**Architecture:** 동일한 `gateC`와 패널 위치를 유지하고 `SHELL_SLIDE` 관련 상태·UI·입력만 `TURTLE_MAZE` 구현으로 교체한다. DFS 미로 생성과 플레이어 좌표를 한 상태 객체에서 관리한다.

## Tasks

- [ ] 게이트와 `PANELS`의 이름·키를 `turtleMaze`로 교체한다.
- [ ] DFS 기반 10×10 미로 생성, 연결 경로 검증, 플레이어 이동 함수를 추가한다.
- [ ] 미로 UI, 방향 버튼, 타이머, 성공/실패/재시작을 추가한다.
- [ ] delegated click handler와 global keydown을 미로 입력에 연결하고 패널 닫힘을 막는다.
- [ ] JS 문법, diff, 브라우저 콘솔과 실제 조작을 검증한다.

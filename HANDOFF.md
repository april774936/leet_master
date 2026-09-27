# leet_master — LEET 기출문제 풀이 웹앱

공개: https://april774936.github.io/leet_master/
저장소: github.com/april774936/leet_master (public)
마지막 갱신: 2026-09-27 (Claude)

## 무엇인가
LEET(법학적성시험) 기출문제 실전 인터랙티브 풀이 웹앱. 언어이해 3-in-1 세트뷰, 추리논증 단일문항뷰, Fisher-Yates 셔플, 오답노트, PWA 지원.

## 저장/동기화
- 기본: 브라우저 localStorage에만 저장(서버 없음).
- 기기간 동기화: Supabase(`leet_sync` 테이블, RLS 미적용 — 비민감 데이터 전제) + `sync.js`. 화면 우측 하단 배지에서 동기화 코드를 직접 입력해야 기기가 연결됨(자동 로그인 아님).

## 배포
GitHub Pages, `main` 브랜치 push 시 자동 반영.

## 알려진 제한
- RLS 없음 — 동기화 코드가 유출되면 제3자가 해당 데이터를 조회할 수 있음(비민감 데이터라 감수한 트레이드오프, 사용자 인지 중).
- 문제 원문은 저작권 있는 공식 기출이므로 재배포/공유 범위에 유의.

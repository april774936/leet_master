# Agent rules for this repo (Claude & Antigravity)

Read `HANDOFF.md` first.

1. 이 폴더는 독립 git 저장소(`leet_master`, GitHub Pages 배포) — antigravity 허브의 다른 프로젝트와 무관하게 작업.
2. 기출문제 데이터는 `data/` 안 원본 파일이 source of truth. 문제 텍스트는 저작권 있는 공식 기출이므로 원본 구조를 유지하고 임의로 재작성하지 말 것.
3. 커밋 전: 브라우저에서 `index.html`을 열어 언어이해 세트 1개 + 추리논증 1문항 정도 풀이 테스트.
4. Supabase 동기화(`sync.js`, `leet_sync` 테이블) 스키마를 바꿀 때는 기존 사용자의 동기화 코드가 깨지지 않는지 확인.
5. 커밋 메시지 접두어: `[claude]` / `[antigravity]`.
6. GitHub Pages는 `main` push 즉시(수 분 내) 자동 반영 — 별도 배포 명령 없음.

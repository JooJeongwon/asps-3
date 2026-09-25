# CONES Kanban

Supabase 프로젝트 ismhrkrkbvlbsxmwhvzb의 GitHub Project 데이터를 실제 Board 화면처럼 보여주는 정적 웹입니다.

## 실행

정적 서버만 있으면 됩니다.

    npm run dev

같은 명령은 내부적으로 Python 표준 라이브러리 서버를 실행합니다.

브라우저에서 http://localhost:4173 을 엽니다.

## 구성

- index.html, styles.css, app.js: GitHub Projects 스타일 Board UI
- config.js: Supabase URL과 publishable key
- data.json: 연결된 DB에서 읽어온 읽기 전용 fallback snapshot
- KANBAN_WORKLOG.md: DB 확인 내용과 작업 기록

현재 DB의 projects, statuses, users, milestones, tasks, task_assignees를 사용합니다. 카드 드래그 이동은 live Supabase 연결 시 tasks.status_id에 반영됩니다.

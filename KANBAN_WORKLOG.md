# CONES Kanban 작업 기록

## 목표

Supabase 프로젝트 ismhrkrkbvlbsxmwhvzb의 DB를 실제 GitHub Projects Board처럼 표시한다. 기존 joo 브랜치의 문서나 데이터는 사용하지 않고 main에서 새로 시작했다.

## 확인한 원본

- Project: CONES
- Repository: seune-h0203/cones
- GitHub Project: 3
- Status: Todo, In Progress, Done
- Tasks: 19개
- Users: 4명
- Task assignee 관계: 26개
- Milestone: CONES — FINAL SUBMISSION

사용 테이블은 projects, statuses, tasks, users, milestones, task_assignees다. Issue state(open/closed)와 Project status는 서로 다른 값이므로 카드에 모두 표시한다.

## 구현 범위

- GitHub Projects와 유사한 어두운 상단 바, 프로젝트 헤더, Board/Table/Roadmap 탭
- Todo / In Progress / Done 3개 컬럼
- Issue 제목, 번호, open/closed 상태, milestone, 담당자 아바타
- 검색 단축키 /, 제목/번호 정렬, 담당자 필터, issue state 필터
- 카드 상세 모달과 원본 GitHub Issue 링크
- 카드 제목을 눌렀을 때 내부에서 열리는 GitHub Issue 스타일 상세 화면
- 카드 drag and drop
- live Supabase REST 조회와 snapshot fallback
- 카드 이동 시 live 모드에서 tasks.status_id PATCH

## 데이터 연결

config.js는 사용자가 제공한 프로젝트 URL과 publishable key를 사용한다. publishable key는 브라우저에 노출 가능한 키이며 service_role/secret key는 사용하지 않는다.

브라우저에서 Supabase REST 조회가 실패하면 data.json을 사용한다. snapshot은 같은 프로젝트에서 MCP로 읽어온 현재 데이터다.

현재 원본 DB에는 Issue 본문, 댓글, timeline, 상태 변경 이력 컬럼/테이블이 없다. 내부 상세 화면은 DB에 실제로 있는 상태, 담당자, milestone, issue state만 표시하고, 본문과 activity는 저장되지 않았다는 사실을 표시한다.

## 보안 메모

현재 Supabase public 테이블 6개에 RLS가 비활성화되어 있다. 이 상태에서는 anon/publishable key를 가진 누구나 전체 행을 읽고 수정할 수 있다. 이번 작업에서는 사용자 요청 범위를 넘는 DB 보안 변경을 자동으로 실행하지 않았다.

운영 배포 전에는 사용자 인증과 소유권 기준을 정한 뒤 RLS와 정책을 추가해야 한다. 정책 없이 RLS만 켜면 앱 읽기도 차단되므로, 접근 모델을 먼저 정하고 적용한다.

## 체크리스트

- [x] 새 Supabase 프로젝트 ref로 원본 스키마 조회
- [x] 실제 데이터 19개 task 확인
- [x] main에서 정적 Board 구현
- [x] live REST / snapshot fallback 구현
- [x] 검색, 필터, 정렬, 모달, drag and drop
- [ ] Auth/RLS 기반 운영 보안
- [ ] Table/Roadmap 실제 뷰

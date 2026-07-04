# 연차·휴가 관리 시스템

Next.js, shadcn/ui, Convex, Convex Auth 기반의 내부 전용 연차·대체휴무 관리 앱입니다.

## 현재 포함된 것

- 매직링크 이메일 로그인
- 직원 프로필, 역할, 연차 정책, 연차 부여, 대체휴무 적립 스키마
- 휴가 신청, 승인/반려, 결근, 사용촉진 로그, 감사로그 테이블
- 연차/대체휴무 잔여 대시보드
- 승인자·관리자용 승인 대기 목록
- 대체휴무 소멸기한 미정 처리: `leavePolicies.compensatoryExpiryDays`는 합의 전 `null`

## 로컬 실행

```bash
npm install
npx convex dev
```

첫 실행 시 Convex 로그인 또는 익명 로컬 개발 배포를 선택하면 `.env.local`이 생성됩니다. Convex watcher는 계속 켜둡니다.

다른 터미널에서 프론트를 실행합니다.

```bash
npm run dev:frontend
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 인증 설정

매직링크 발송에는 Resend 키가 필요합니다. Convex 배포가 잡힌 뒤 실행합니다.

```bash
npm run setup:auth
```

필요한 값은 `.env.local.example`을 참고하세요. SSO/GitHub OAuth는 사용하지 않습니다.

## 주요 파일

- `convex/schema.ts`: 도메인 테이블과 인덱스
- `convex/leave.ts`: 대시보드, 데모 데이터 생성, 신청, 승인/반려 함수
- `convex/auth.ts`: Convex Auth 매직링크 provider
- `app/product/LeaveDashboard.tsx`: 내부 대시보드
- `app/signin/page.tsx`: 이메일 로그인 화면
- `middleware.ts`: `/product` 보호 라우팅

## 검증

```bash
npm run build
```

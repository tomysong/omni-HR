# 연차·휴가 관리 시스템

Next.js, shadcn/ui, Convex, Convex Auth 기반의 내부 전용 연차·대체휴무 관리 앱입니다.

## 인증·가입 흐름

1. 이메일+비밀번호로 회원가입 (비밀번호: 8자 이상, 영문+숫자 필수)
2. 이메일로 발송된 6자리 코드 입력 (Resend OTP)
3. 로그인 후 이름/부서를 입력해 **관리자에게 가입 승인 요청**
4. 관리자가 [직원] 탭에서 사번·입사일·권한을 지정해 승인하면 사용 가능

조직에 직원 프로필이 하나도 없으면 첫 로그인 사용자가 "관리자로 시작"
버튼으로 부트스트랩합니다. 이후 가입자는 모두 승인 절차를 거칩니다.

## 현재 포함된 것

- 회원가입 + 이메일 인증 + 관리자 승인 게이트 (`convex/access.ts`, `app/product/AccessGate.tsx`)
- 직원 프로필, 역할, 연차 정책, 연차 부여, 대체휴무 적립 스키마
- 휴가 신청, 승인/반려(자기 결재 금지), 결근, 사용촉진 로그, 감사로그 테이블
- 연차/대체휴무(일 단위) 잔여 대시보드
- 관리자용 초기 잔여 수동 설정 (이전 시스템 이월분)
- 비승인자에게 타 직원 민감정보(사번/이메일/잔여) 마스킹
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

가입 인증 코드 발송에 Resend 키가 필요합니다. Convex 배포가 잡힌 뒤 실행합니다.

```bash
npm run setup:auth
```

필요한 값은 `.env.local.example`을 참고하세요. Convex 배포 환경변수에
`AUTH_RESEND_KEY`, `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`가 있어야 합니다.

## 백엔드 구조 (convex/)

- `schema.ts`: 도메인 테이블과 인덱스
- `model.ts`: 공유 헬퍼 (권한 가드, 잔여 계산, 감사로그) — 엔드포인트 없음
- `auth.ts`: 비밀번호 인증 + OTP 이메일 검증
- `access.ts`: 가입 승인 요청/승인/반려
- `leave.ts`: 워크스페이스 조회, 휴가 신청, 결재
- `employees.ts`: 부트스트랩, 직원 등록, 초기 잔여 설정
- `policy.ts`: 연차 정책 수정

## 배포

Cloudflare Workers (OpenNext 어댑터). main 브랜치 push 시 Workers Builds가
자동 빌드·배포합니다. 수동 배포는 `npm run deploy`.

## 검증

```bash
npm run build
```

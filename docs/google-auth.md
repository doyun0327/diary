# Google 계정 로그인 (현재 구현 정리)

PageBy 프론트에 붙어 있는 **Google 로그인** 흐름과, 아직 안 된 부분을 정리한 문서입니다.

> 작성 기준: 현재 레포 코드 (`useAuthSession` / `googleAuth` / `authApi`)

---

## 한 줄 요약

```
계정 시트에서 Google 클릭
  → Google Identity Services로 idToken 발급
  → Spring Boot POST /api/auth/google 에 idToken 전달
  → 서버 JWT(accessToken) + user 정보 수신
  → localStorage에 토큰·세션 저장
```

**일기 클라우드 동기화**는 `POST /api/diaries/sync` 로 연동됩니다. 자세한 내용: [diary-sync.md](./diary-sync.md).  
**Apple 로그인**은 아직 미연동입니다.

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/googleAuth.ts` | Google Identity Services(GIS) 로드, One Tap / 버튼으로 **idToken** 받기 |
| `src/api/authApi.ts` | `POST /api/auth/google`, `GET /api/me`, `POST /api/auth/logout` |
| `src/hooks/useAuthSession.ts` | 로그인/로그아웃/세션·JWT 저장, UI에서 쓰는 훅 |
| `src/components/AccountSheet.tsx` | 계정 메뉴 UI (Google / Apple 버튼) |
| `src/api/config.ts` | API base URL (`VITE_API_BASE_URL`) |
| `vite.config.ts` | 개발 시 `/api` → `http://localhost:8080` 프록시 |
| `.env.development` / `.env.production` | `VITE_GOOGLE_CLIENT_ID` |

---

## 환경 변수

```env
# Google Cloud Console → OAuth 2.0 Web 클라이언트 ID
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

- **개발**: `.env.development`
- **프로덕션 빌드**: `.env.production`
- 값 없으면 `signIn('google')` 시  
  `VITE_GOOGLE_CLIENT_ID 설정이 없어요` 에러

개발 서버에서 API는 Vite 프록시로 Spring Boot(`8080`)에 붙습니다.  
프로덕션은 `.env.production`의 `VITE_API_BASE_URL`을 사용합니다.

---

## 로그인 시퀀스 (상세)

### 1) UI

`AccountSheet`에서 **Google로 계속** 클릭 → `useAuthSession().signIn('google')`

### 2) 프론트: idToken 받기 (`googleAuth.ts`)

1. `https://accounts.google.com/gsi/client` 스크립트 로드
2. `google.accounts.id.initialize({ client_id, callback })`
3. **One Tap** (`prompt`) 시도
4. One Tap이 안 뜨거나 스킵되면 → 화면 중앙에 **Google 공식 버튼** 모달 (`renderButton`)
5. 성공 시 callback의 `credential` = **Google ID Token (JWT 문자열)**

### 3) 프론트 → 백엔드 (`authApi.ts`)

```http
POST /api/auth/google
Content-Type: application/json

{ "idToken": "<Google ID Token>" }
```

기대 응답 형태:

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "photoUrl": "...",
    "provider": "google"
  }
}
```

### 4) 세션 저장 (`useAuthSession.ts`)

| localStorage 키 | 내용 |
|-----------------|------|
| `picture-diary-access-token` | 서버 JWT |
| `picture-diary-auth-session` | UI용 세션 (`provider`, `email`, `displayName`, `photoUrl`, `userId`, …) |

### 5) 로그아웃

1. (가능하면) `POST /api/auth/logout` + `Authorization: Bearer <token>`
2. localStorage 토큰·세션 삭제

### 6) 세션 재확인 (선택)

`refreshMe()` → `GET /api/me` + Bearer  
실패 시 로컬 세션/토큰 삭제

---

## Google Cloud Console 설정 (프론트 쪽)

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → 사용자 인증 정보
2. **OAuth 2.0 클라이언트 ID** (애플리케이션 유형: **웹 애플리케이션**) 생성
3. **승인된 JavaScript 원본**에 프론트 주소 추가  
   예: `http://localhost:5173`, 배포 도메인
4. 발급된 클라이언트 ID를 `VITE_GOOGLE_CLIENT_ID`에 넣기

> Spring Boot에서도 같은 Client ID로 idToken을 검증해야 합니다.  
> (백엔드용 Client Secret은 **idToken 검증만** 할 때는 필수는 아니지만, 콘솔/프로젝트 설정은 맞춰 두는 게 좋습니다.)

---

## Spring Boot 백엔드가 맞춰야 하는 API

프론트가 이미 호출하는 계약:

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/auth/google` | body `{ idToken }` → Google 토큰 검증 → User upsert → **JWT 발급** |
| `GET` | `/api/me` | `Authorization: Bearer` → 현재 유저 |
| `POST` | `/api/auth/logout` | (선택) 서버 측 무효화 |

백엔드 핵심:

1. Google `idToken` 검증 (`GoogleIdTokenVerifier` 등, audience = Web Client ID)
2. `sub` / email로 `users` 테이블 upsert
3. 앱용 JWT 발급
4. CORS: 프론트 origin 허용

---

## 아직 안 된 것 / 주의

| 항목 | 상태 |
|------|------|
| Google 로그인 (idToken → JWT) | ✅ 프론트 연동됨 (백엔드 구현·가동 필요) |
| Apple 로그인 | ❌ `Apple 로그인은 아직 준비 중` |
| 일기 클라우드 동기화 | ✅ `POST /api/diaries/sync` (자세한 내용: [diary-sync.md](./diary-sync.md)) |
| 계정 시트의 `mockNote` 문구 | ✅ 동기화 안내로 갱신됨 |
| JWT 자동 갱신(refresh) | ❌ 만료 시 `refreshMe` 실패 → 재로그인 필요 |

평소 편집은 **기기 `localStorage`** (`picture-diary-entries`)에 두고, 동기화 시 서버와 맞춥니다.

---

## 로컬에서 확인하는 방법

1. Spring Boot를 `8080`에서 실행하고 `/api/auth/google` 가 동작하는지 확인
2. 프론트: `npm run dev` (기본 Vite 포트, 예: `5173`)
3. `.env.development`에 `VITE_GOOGLE_CLIENT_ID` 설정
4. Google Console에 `http://localhost:5173` JavaScript 원본 등록
5. 앱 → 계정 → **Google로 계속**

브라우저 개발자 도구 Network에서:

- GIS 스크립트 / Google 인증
- `POST /api/auth/google` 요청·응답

을 확인하면 됩니다.

---

## 관련 코드 진입점

```ts
/* AccountSheet → */
await signIn('google');

/* useAuthSession */
const idToken = await requestGoogleIdToken(clientId);
const auth = await loginWithGoogleIdToken(idToken);
saveToken(auth.accessToken);
saveSession({ ... });
```

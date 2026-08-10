# 일기 클라우드 동기화

Google 로그인 후 일기(`DiaryEntry`)를 Spring Boot에 백업·복구하는 흐름입니다.

---

## 흐름

```
일기 저장 / 삭제 (로그인된 경우)
  → localStorage 반영 후
  → POST /api/diaries/sync (백그라운드)
  → lastSyncedAt 갱신

로그인 직후
  → since: null 전체 sync 1회
```

수동 「지금 동기화」 버튼은 없습니다.

---

## API (Spring Boot · JWT 필수)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/diaries` | 내 활성 일기 목록 |
| `POST` | `/api/diaries/sync` | push/pull 동기화 |

### Request `POST /api/diaries/sync`

```json
{
  "since": "2026-08-01T00:00:00Z",
  "entries": [
    {
      "id": "uuid",
      "date": "2026-08-10",
      "title": "",
      "content": "...",
      "imageUrl": "data:image/... or https://...",
      "mood": "happy",
      "fontId": "gaegu",
      "createdAt": "2026-08-10T01:00:00Z",
      "updatedAt": "2026-08-10T02:00:00Z"
    }
  ],
  "deletedIds": ["uuid-deleted"]
}
```

- `since`: 마지막 성공 동기화 시각. `null`이면 전체 pull.
- `entries`: 로컬에 있는 일기(전체 또는 변경분). 서버는 **updatedAt이 같거나 더 새로울 때만** 덮어씀 (LWW).
- `deletedIds`: 로컬에서 지운 id → 서버 soft-delete.

### Response

```json
{
  "serverTime": "2026-08-10T03:00:00Z",
  "entries": [ /* since 이후 변경된 활성 일기 (since=null이면 전체) */ ],
  "deletedIds": [ /* since 이후 soft-delete된 id */ ]
}
```

---

## 백엔드 코드 위치 (`diary_back`)

| 파일 | 역할 |
|------|------|
| `diary/domain/DiaryEntryEntity.java` | `diary_entries` 테이블 (Lob content/image, soft-delete) |
| `diary/repository/DiaryEntryRepository.java` | 유저별 조회 |
| `diary/service/DiarySyncService.java` | LWW sync |
| `diary/controller/DiaryController.java` | REST |
| `config/SecurityConfig.java` | `/api/diaries/**` → `authenticated` |

---

## 프론트 코드 위치 (`diary`)

| 파일 | 역할 |
|------|------|
| `src/api/diariesApi.ts` | `fetchDiaries` / `syncDiaries` |
| `src/utils/diarySync.ts` | 로컬 LWW merge |
| `src/hooks/useDiary.ts` | tombstone(`picture-diary-deleted-ids`) + `syncWithCloud` |
| `src/components/AccountSheet.tsx` | 로그인 직후 sync · 수동 버튼 없음 |
| `src/App.tsx` | 저장·삭제 시 `syncInBackground` |
| `src/App.tsx` | `onSyncDiaries={syncWithCloud}` |

### localStorage

| 키 | 내용 |
|----|------|
| `picture-diary-entries` | 일기 배열 |
| `picture-diary-deleted-ids` | 아직 서버에 알리지 않은 삭제 id |
| `picture-diary-access-token` | JWT |
| `picture-diary-auth-session` | UI 세션 (`lastSyncedAt` 포함) |

---

## 주의

1. **그림 `imageUrl`이 data URL이면 payload가 큼** — Tomcat/ multipart 한도(현재 ~20MB)와 DB Lob 용량을 염두에 두세요. 장기적으로는 GCS URL만 저장하는 편이 낫습니다.
2. H2 in-memory면 서버 재시작 시 일기 DB도 사라집니다. Cloud Run + PostgreSQL 등 영속 DB를 쓰세요.
3. Apple 로그인·자동 백그라운드 동기화는 아직 없음.

---

## 로컬 확인

1. `diary_back` 실행 (`8080`)
2. `diary` → `npm run dev` (Vite가 `/api` 프록시)
3. Google 로그인 → 일기 저장 시 Network에서 `POST /api/diaries/sync` 확인
4. 다른 기기/시크릿에서 같은 계정 로그인 → 일기 복구 확인

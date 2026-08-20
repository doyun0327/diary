# 구독 계정 월 50장 작성 한도

프론트는 `GET/POST /api/usage/monthly` 로 계정별 카운트를 맞춥니다.  
**삭제한 일기도 한도에 포함**해야 해서 `diary_entries` COUNT만으로는 부족합니다.

백엔드 구현: `diary_back` — `usage` 패키지, `users.monthly_write_*` 컬럼.

---

## Neon / Postgres 마이그레이션

`diary_back/sql/migrate-users-monthly-write.sql` 실행:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_write_ym VARCHAR(7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_write_count INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_monthly_write_ym ON users (monthly_write_ym);
```

로컬 H2는 JPA `ddl-auto=update` 로 자동 반영됩니다.

---

## API (구현됨)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/usage/monthly` | JWT 필요. `{ yearMonth, used, limit, allowed }` |
| `POST` | `/api/usage/monthly/consume` | 신규 일기 저장 시 +1. 50 초과 시 **409** |

응답 예:

```json
{
  "yearMonth": "2026-08",
  "used": 1,
  "limit": 50,
  "allowed": true
}
```

- `yearMonth`: `Asia/Seoul` 기준 `yyyy-MM`
- 달이 바뀌면 `monthly_write_count` → 0
- 수정(edit)은 프론트에서 consume 호출 안 함
- 한도 상수: `app.usage.monthly-limit` (기본 50)

---

## 백엔드 파일

| 파일 | 역할 |
|------|------|
| `auth/domain/UserAccount.java` | `monthly_write_ym`, `monthly_write_count` |
| `usage/controller/UsageController.java` | REST |
| `usage/service/MonthlyUsageService.java` | 월 리셋·차감 |
| `exception/ConflictException.java` | 409 |
| `config/SecurityConfig.java` | `/api/usage/**` authenticated |

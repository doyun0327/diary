# 구독 계정 월 50장 · AI 추가구매 팩

프론트는 `GET/POST /api/usage/monthly` · `/api/usage/ai-pack*` 로 계정별 카운트를 맞춥니다.

백엔드 구현: `diary_back` — `usage` 패키지, `users.monthly_write_*`, `users.ai_pack_credits`.

---

## Neon / Postgres 마이그레이션

```sql
-- diary_back/sql/migrate-users-monthly-write.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_write_ym VARCHAR(7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_write_count INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_monthly_write_ym ON users (monthly_write_ym);

-- diary_back/sql/migrate-users-ai-pack-credits.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_pack_credits INT NOT NULL DEFAULT 0;
```

로컬 H2는 JPA `ddl-auto=update` 로 자동 반영됩니다.

---

## API

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/usage/monthly` | `{ yearMonth, used, limit, allowed }` |
| `POST` | `/api/usage/monthly/consume` | +1. 한도 초과 **409** |
| `POST` | `/api/usage/monthly/refund` | 생성 실패 시 1회 환불 |
| `GET` | `/api/usage/ai-pack` | `{ credits }` |
| `POST` | `/api/usage/ai-pack/grant` | body `{ count }` IAP 지급 |
| `POST` | `/api/usage/ai-pack/consume` | 팩 1회 차감. 0이면 **409** |
| `POST` | `/api/usage/ai-pack/refund` | 팩 1회 환불 |

- `yearMonth`: `Asia/Seoul` `yyyy-MM`, 달 바뀌면 월 카운트 0
- `ai_pack_credits`는 월 리셋과 무관
- 한도: `app.usage.monthly-limit` (기본 50)

---

## 백엔드 파일

| 파일 | 역할 |
|------|------|
| `auth/domain/UserAccount.java` | `monthly_write_*`, `ai_pack_credits` |
| `usage/controller/UsageController.java` | REST |
| `usage/service/MonthlyUsageService.java` | 월 차감 |
| `usage/service/AiPackCreditsService.java` | 팩 지급·차감 |
| `sql/migrate-users-ai-pack-credits.sql` | 마이그레이션 |

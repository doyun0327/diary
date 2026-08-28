# RevenueCat 구독 연동 (PageBy)

## 상품 정책

| 항목 | 값 |
|------|-----|
| 무료 | 가입 후 **5장** (검색·보내기 불가) |
| 구독 | **월 1,900원** (`pageby_monthly`, 스토어에서 현지 가격 표시) |
| 구독 혜택 | **검색**, **보내기**, **월 50장** 작성 |

코드 상수: `src/utils/diaryAccess.ts`, `lib/subscription_config.dart`

---

## 1. RevenueCat 프로젝트

1. [RevenueCat](https://www.revenuecat.com/) 가입 → 새 Project
2. **Apps** 에 Android / iOS 앱 추가
3. 각 앱의 **Public API Key** 복사

`diary_app/lib/subscription_config.dart` 에 키 입력:

```dart
static const googleApiKey = 'goog_...';
static const appleApiKey = 'appl_...';
```

또는 빌드 시:

```bash
flutter run --dart-define=REVENUECAT_GOOGLE_KEY=goog_xxx --dart-define=REVENUECAT_APPLE_KEY=appl_xxx
```

---

## 2. Google Play Console (Android)

1. **Monetize → Subscriptions** → 구독 생성
2. Product ID: **`pageby_monthly`**
3. 가격: **₩1,900 / 1 month**
4. RevenueCat 대시보드 → Google Play 서비스 계정 JSON 연결

---

## 3. App Store Connect (iOS)

1. **Subscriptions** 그룹 생성
2. Product ID: **`pageby_monthly`**
3. 가격: **₩1,900 / 1 month**
4. RevenueCat에 App Store Connect API Key 연결

---

## 4. RevenueCat Entitlement / Offering

1. **Entitlements** → `premium` 생성
2. **`pageby_monthly`** 를 `premium` entitlement에 연결
3. **Offerings** → `default` offering 에 monthly 패키지 추가

앱 코드의 ID와 반드시 일치:

- Entitlement: `premium`
- Product: `pageby_monthly`

---

## 5. 앱 동작 (구현됨)

| Web → Flutter 메시지 | 동작 |
|---------------------|------|
| `subscriptionIdentify` | RevenueCat `logIn(userId)` |
| `subscriptionSync` | 구독 상태 조회 → WebView 전달 |
| `subscriptionPurchase` | 월 구독 결제 |
| `subscriptionRestore` | 구매 복원 |

WebView 콜백:

- `window.__onDiarySubscriptionStatus({ active, expiresAt, productId? })` — 일반 동기화
- **`window.__onDiarySubscriptionPurchaseComplete({ active, expiresAt, productId? })`** — **결제 완료 직후 필수** (Pro 즉시 반영)

결제 성공 시 Flutter에서 `__onDiarySubscriptionPurchaseComplete` 를 호출한 뒤, 필요하면 `subscriptionSync` 로 한 번 더 맞춥니다.

```dart
// RevenueCat purchase 성공 직후 (예시)
await webController.runJavaScript('''
  window.__onDiarySubscriptionPurchaseComplete?.({
    active: true,
    expiresAt: ${expiresAtMs},
    productId: "pageby_monthly"
  });
''');
```

---

## 6. Play Store 라이선스 테스트 (Android)

구독 테스트는 **USB 디버그 APK + 127.0.0.1 WebView** 와 별개로, **Play Console에 올린 빌드를 Play 스토어(내부 테스트)에서 설치**해야 안정적으로 됩니다.

### 6-1. Play Console 설정

1. [Google Play Console](https://play.google.com/console) → **pageBy** (`com.yun.diary_app`)
2. **수익 창출 설정**이 완료돼 있어야 함 (은행·세금·상인 계정)
3. **수익 창출 → 구독** 에 `pageby_monthly` (₩3,300/월) **활성** 상태인지 확인
4. **설정 → 라이선스 테스트** (영문: *Settings → License testing*)
5. **라이선스 테스터**에 테스트용 **Gmail** 추가  
   - 예: 본인 갤럭시에 로그인된 Google 계정  
   - `@googlemail.com` 등 별칭도 가능
6. **내부 테스트** 트랙 생성 → AAB 업로드

```bash
cd diary_App/diary_app
flutter build appbundle --release \
  --dart-define=REVENUECAT_GOOGLE_KEY=goog_여기에키
```

7. Play Console → **테스트 → 내부 테스트** → 릴리스에 AAB 연결 → **테스터 목록**에 같은 Gmail 추가
8. **내부 테스트 참여 링크**를 폰 브라우저에서 열어 **Play 스토어로 설치**

### 6-2. 폰(갤럭시) 준비

1. **Play 스토어** 앱에 **라이선스 테스터로 등록한 Gmail** 로 로그인
2. 기존에 `flutter run` 으로 깔아 둔 debug 앱이 있으면 **삭제** (패키지 충돌·서명 불일치 방지)
3. 내부 테스트 링크로 **Play에서 설치한 pageBy** 실행
4. USB로 웹만 쓸 경우: `adb reverse tcp:5173 tcp:5173` 후 앱 실행

### 6-3. 구독 테스트

1. RevenueCat `subscription_config.dart` 에 **Google Public API Key** 입력
2. 앱에서 일기 **5장까지 작성** → 6번째에 구독 모달
3. **월 3,300원 구독하기** → Play 결제창  
   - 라이선스 테스터는 **실제 청구 없음** (카드에 TEST / 무료 테스트 표시)
4. [RevenueCat Dashboard](https://app.revenuecat.com/) → Customers → entitlement **`premium`** active 확인

### 6-4. 테스트 구독 갱신 주기

Play **테스트 구독**은 짧게 돌아갑니다 (대략):

| 실제 기간 | 테스트 |
|-----------|--------|
| 1주 | ~3분 |
| 1개월 | ~5분 |
| 1년 | ~30분 |

만료·갱신·취소 UX 확인에 유용합니다.

### 6-5. 자주 막히는 경우

| 증상 | 확인 |
|------|------|
| 결제창 안 뜸 | RevenueCat 키 `REPLACE_ME` 아닌지, Offering에 `pageby_monthly` 연결 |
| "아이템을 구매할 수 없음" | 구독 상품 **활성** 여부, 내부 테스트 AAB 업로드 여부 |
| 테스터인데 유료로 뜸 | Play 스토어 Gmail ≠ 라이선스 테스터 Gmail |
| debug `flutter run` 만 사용 | **내부 테스트 Play 설치본**으로 다시 테스트 |

---

## 7. iOS 테스트 (참고)

App Store Connect → **Sandbox Tester** 계정 생성 → 실기기 **설정 → App Store → 샌드박스 계정** 로그인 → TestFlight 또는 Xcode 설치본으로 테스트.

---

## 8. 출시 전 체크

- [ ] API 키가 `REPLACE_ME` 가 아님
- [ ] Play / App Store 가격 ₩3,300
- [ ] 앱 내 구독 안내·해지 방법 문구 (설정/앱 정보)
- [ ] iOS **구매 복원** 버튼 (구현됨: 한도 모달 하단)

# 쉬운말 분석 백엔드

브라우저가 보낸 문서(글·사진·PDF)를 Claude API로 읽고, `shared/schemas/result.ts`의
`AnalysisResult` 모양으로 돌려주는 AWS Lambda 함수입니다.

- 모델: `claude-opus-5-5` (환경 변수 `CLAUDE_MODEL`로 바꿀 수 있음), 노력 수준 `medium` (`CLAUDE_EFFORT`)
- 구조화 출력(`output_config.format`)으로 스키마에 맞는 JSON만 받습니다 (`src/schema.ts`)
- 안전 분류기가 거절하면 서버 측 대체 모델(`fallbacks: "default"`)이 이어서 처리합니다
- 검증 단계(`src/verify.ts`): 숫자 범위 맞추기, 잘못된 날짜 걸러내기, 글 입력이면 원문에 없는 인용 걷어내기,
  옮겨 적은 글의 개인정보 한 번 더 가리기
- 문서는 메모리에서만 다룹니다. S3·DB에 저장하지 않고, 로그에는 토큰 사용량만 남깁니다

## 요청과 응답

`POST /` (JSON)

```json
{
  "text": "붙여넣은 글 (선택)",
  "files": [{ "name": "1.jpg", "media_type": "image/jpeg", "data": "<base64>" }],
  "doc_type_hint": "사용자가 고른 문서 종류 (선택)",
  "today": "2026-11-27"
}
```

성공하면 `{ "result": AnalysisResult }`, 실패하면 `{ "error": "사용자에게 보여줄 문장" }`.
프런트엔드는 사진을 긴 변 2000px JPEG로 줄여 보냅니다 (함수 URL 요청 한도 6MB).

## 로컬 실행

```bash
npm install
ANTHROPIC_API_KEY=... npm run dev   # http://localhost:8787
```

## 배포 (Lambda 함수 URL)

```bash
npm run package   # function.zip 생성 (dist/index.mjs 하나)
```

1. Lambda 함수를 Node.js 22 런타임으로 만들고 `function.zip`을 올립니다. 핸들러는 `index.handler`.
2. 제한 시간은 넉넉히(예: 3분), 메모리는 512MB 이상.
3. 환경 변수
   - `ANTHROPIC_API_KEY` — 비밀값. 가능하면 Secrets Manager 등으로 관리하세요
   - `ALLOWED_ORIGINS` — `https://torgeleli22-lang.github.io` (쉼표로 여러 개)
   - 선택: `CLAUDE_MODEL`, `CLAUDE_EFFORT`
4. 함수 URL을 켜고(인증 NONE) 그 주소를 저장소 Settings → Secrets and variables → Actions → Variables에 `VITE_API_URL`로 넣습니다. 다음 배포부터 실제 백엔드를 씁니다.

함수 URL은 누구나 부를 수 있어 요금이 나갈 수 있습니다. 출처 검사(`ALLOWED_ORIGINS`)는 브라우저 밖에서는
쉽게 우회되므로, **예약 동시성(reserved concurrency)으로 동시 실행 수를 제한**하고, 실제 공개 전에는
API Gateway의 사용량 제한이나 WAF 속도 제한을 앞에 두는 것을 권합니다.

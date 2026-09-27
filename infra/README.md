# 서버 올리기 (AWS)

`template.yaml` 하나로 서버에 필요한 것을 모두 만듭니다.

| 만들어지는 것 | 하는 일 |
| --- | --- |
| Lambda 함수 + 전용 주소(Function URL) | `POST /upload-urls` 사진 업로드 주소 발급, `POST /analyze` 문서 분석 |
| S3 버킷 | 사진 임시 보관. 분석 직후 지우고, 남은 것도 하루 뒤 자동 삭제 |
| 예산 알림 (선택) | 한 달 사용 금액이 예산의 80%를 넘거나 넘을 것 같으면 이메일 |
| 로그 보관 규칙 | 서버 기록을 2주만 보관. 문서 내용은 기록하지 않음 |

지역은 서울(`ap-northeast-2`)입니다. Claude는 Bedrock의 전역(Global) 경로로 부릅니다.

## 처음 한 번 준비

1. AWS 콘솔 오른쪽 위에서 지역을 **아시아 태평양(서울)** 으로 고릅니다.
2. Bedrock 화면의 **Model access**에서 Anthropic Claude 모델 사용을 신청합니다.
   기본값은 Claude Opus 5(`anthropic.claude-opus-5`)이고, 거절 시 재시도용으로
   Claude Opus 4.8(`anthropic.claude-opus-4-8`)을 씁니다. 두 모델 모두 신청해 두세요.

## 올리기

AWS 콘솔 위쪽의 CloudShell(명령창 아이콘)을 열고 아래를 붙여넣습니다.
비밀키를 따로 만들 필요가 없습니다. CloudShell은 로그인한 계정 권한으로 동작합니다.

```bash
git clone https://github.com/torgeleli22-lang/Easy_document.git
cd Easy_document/infra
sam build
sam deploy --parameter-overrides BudgetEmail=받을이메일@example.com
```

끝나면 `Outputs`의 `ApiUrl` 값(`https://….lambda-url.ap-northeast-2.on.aws/`)이 서버 주소입니다.
이 주소를 `frontend/.env.production`의 `VITE_API_URL`에 넣으면 화면이 실제 서버에 연결됩니다.
공개돼도 되는 값입니다.

예산 알림을 설정했다면 AWS에서 확인 메일이 오니 메일 안의 링크를 눌러 주세요.

## 고친 뒤 다시 올리기

```bash
cd Easy_document && git pull
cd infra && sam build && sam deploy
```

## 설정값

`sam deploy --parameter-overrides 이름=값`으로 바꿀 수 있습니다.

| 이름 | 기본값 | 뜻 |
| --- | --- | --- |
| `ModelId` | `anthropic.claude-opus-5` | 분석에 쓰는 모델 |
| `FallbackModelId` | `anthropic.claude-opus-4-8` | 기본 모델이 답을 거절하면 한 번 더 시도할 모델 |
| `AllowedOrigins` | GitHub Pages 주소, `http://localhost:5173` | 서버를 부를 수 있는 화면 주소 |
| `BudgetEmail` | (없음) | 예산 알림을 받을 이메일 |
| `MonthlyBudgetUsd` | `10` | 한 달 예산(달러) |

## 지우기

```bash
sam delete
```

S3 버킷에 사진이 남아 있으면 지우기가 실패할 수 있습니다. 하루 기다리면 자동 삭제되니 그 뒤에 다시 실행하세요.

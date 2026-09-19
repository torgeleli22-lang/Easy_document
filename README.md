# 쉬운말

어려운 문서를 사진 한 장으로 올리면, 쉬운 말로 풀어주고 · 해야 할 일과 기한을 정리하고 · 주의할 점을 짚어주는 서비스입니다.

기획서: `docs/` (예정) · 구성안: 프로젝트 파일의 `쉬운말-저장소-구성안.md`

## 구성

| 경로 | 내용 |
| --- | --- |
| `frontend/` | React + Vite. GitHub Pages로 배포되는 정적 화면 |
| `shared/schemas/` | 분석 결과 스키마. 프런트엔드와 백엔드가 함께 쓰는 단일 출처 |
| `backend/` | AWS Lambda (예정) |
| `infra/` | IaC (예정, 도구 미정) |
| `eval/` | 평가 세트와 지표 측정 (예정) |

## 개발

```bash
cd frontend
npm install
npm run dev
```

지금은 백엔드가 없어서 목업 데이터로 동작합니다. 파일을 고르거나 글을 붙여넣으면
근로계약서 분석 결과가 스트리밍되는 것처럼 보입니다.

결과 화면에서 워드(.docx) 파일을 내려받을 수 있습니다. 원본을 문서에 싣고
원문 문단 바로 아래에 설명 박스를 붙이는 구조이며, 파일은 전부 브라우저 안에서
만들어집니다. 원본 서식과 레이아웃은 보존되지 않습니다.

- `npm run build` — 타입 검사 후 빌드
- `npm run typecheck` — 타입 검사만

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 빌드해서 GitHub Pages로 올립니다.
주소는 `https://torgeleli22-lang.github.io/Easy_document/` 이고,
그래서 `vite.config.ts`의 `base`가 `/Easy_document/`로 잡혀 있습니다.

## 원칙

- **무저장**: 문서를 서버에 저장하지 않습니다. 공유·다운로드 파일은 브라우저 안에서 만듭니다.
- **큰 글씨가 기본**: 접근성 토큰은 `frontend/src/styles/tokens.css`에 모아두었습니다.
- **근거 표시**: 모든 항목에 원문 인용을 붙이고, 문서에 적힌 내용과 일반 안내를 구분합니다.

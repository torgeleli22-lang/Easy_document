/**
 * 사용자에게 보여줄 수 있는 오류.
 *
 * message는 화면에 그대로 나가므로 쉬운 말로 씁니다.
 * 내부 사정(모델 이름, 스택 등)은 로그에만 남깁니다.
 */
export type ErrorCode =
  | 'bad_request'
  | 'forbidden_origin'
  | 'not_found'
  | 'too_large'
  | 'unreadable'
  | 'refused'
  | 'invalid_output'
  | 'upstream';

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  forbidden_origin: 403,
  not_found: 404,
  too_large: 413,
  unreadable: 422,
  refused: 422,
  invalid_output: 502,
  upstream: 502,
};

export class AnalysisError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}

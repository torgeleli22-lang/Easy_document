import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnalysisProvider } from '@/state/AnalysisContext';
import { CapturePage } from '@/features/capture/CapturePage';
import { AnalysisPage } from '@/features/analysis/AnalysisPage';
import { ResultPage } from '@/features/result/ResultPage';

/**
 * GitHub Pages는 정적 파일만 서빙해서 /result 같은 주소로 바로 들어오면 404가 납니다.
 * HashRouter를 쓰면 별도 설정 없이 동작하고, 어차피 분석 상태는 메모리에만
 * 있어서 주소를 공유해봐야 의미가 없습니다 (무저장 원칙).
 */
export function App() {
  return (
    <AnalysisProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<CapturePage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AnalysisProvider>
  );
}

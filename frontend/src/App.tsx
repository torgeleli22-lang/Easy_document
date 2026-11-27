import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnalysisProvider } from '@/state/AnalysisContext';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CapturePage } from '@/features/capture/CapturePage';
import { AnalysisPage } from '@/features/analysis/AnalysisPage';
import { ResultPage } from '@/features/result/ResultPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { ArchivePage } from '@/features/archive/ArchivePage';
import { ArchiveDetailPage } from '@/features/archive/ArchiveDetailPage';

/**
 * GitHub Pages는 정적 파일만 서빙해서 /result 같은 주소로 바로 들어오면 404가 납니다.
 * HashRouter를 쓰면 별도 설정 없이 동작합니다. 분석 상태는 메모리에만 있고,
 * 보관함·일정은 이 기기 안(IndexedDB)에만 있어서 주소를 공유해도 남에게는 보이지 않습니다.
 */
export function App() {
  return (
    <AnalysisProvider>
      <HashRouter>
        <div className="app">
          <SiteHeader />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<CapturePage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/result" element={<ResultPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/archive/:id" element={<ArchiveDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <SiteFooter />
        </div>
      </HashRouter>
    </AnalysisProvider>
  );
}

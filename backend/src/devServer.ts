import { createServer } from 'node:http';
import { handler } from './handler';

/**
 * 로컬 개발용 서버. Lambda 함수 URL과 같은 모양으로 handler를 불러줍니다.
 *
 *   ANTHROPIC_API_KEY=... npm run dev
 *   (frontend/.env.local 에 VITE_API_URL=http://localhost:8787 )
 */
const PORT = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const response = await handler({
    body: Buffer.concat(chunks).toString('utf8'),
    headers: { origin: req.headers.origin },
    requestContext: { http: { method: req.method } },
  });

  res.writeHead(response.statusCode, response.headers);
  res.end(response.statusCode === 204 ? undefined : response.body);
}).listen(PORT, () => {
  console.log(`쉬운말 분석 서버: http://localhost:${PORT}`);
});

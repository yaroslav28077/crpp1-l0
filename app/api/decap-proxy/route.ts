// ТИМЧАСОВИЙ файл лише для локального огляду адмінки. Видалити після перевірки.
// У пісочниці назовні відкрито лише порт dev-сервера, тож браузер не дістає
// decap-server на 8081 — проводимо його запити через сам Next.
export async function POST(request: Request) {
  const body = await request.text()
  const res = await fetch('http://127.0.0.1:8081/api/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

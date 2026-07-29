import { buildSearchIndex } from '@/lib/search-index'

// Індекс збирається під час збірки й лягає у статику разом із рештою сайту
export const dynamic = 'force-static'

export function GET() {
  return Response.json(buildSearchIndex())
}

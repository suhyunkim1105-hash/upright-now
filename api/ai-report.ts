import { handleAiReport } from './ai-report-handler'

export const maxDuration = 15

export default function aiReport(request: Request): Promise<Response> {
  return handleAiReport(request)
}

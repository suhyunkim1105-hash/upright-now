const completedReport = {
  headline: '이번 흐름을 짧게 정리했어요.',
  reflection: '집중 시간과 회복 행동을 다음 세션의 출발점으로 남겨 보세요.',
  highlights: [
    { label: '집중 시간', detail: '계획한 흐름을 끝까지 이어 갔어요.' },
    { label: '회복 행동', detail: '리셋이 필요할 때 다시 흐름을 만들었어요.' },
    { label: '다음 시도', detail: '짧은 단위로 바로 이어 가기 좋아요.' },
  ],
  nextAction: {
    title: '2분 정리 후 다시 시작',
    instruction: '다음 할 일을 적고 2분 안에 시작해 보세요.',
    durationMinutes: 2,
  },
}

const abortedReport = {
  headline: '여기서 다시 이어 가면 돼요.',
  reflection: '오늘 남긴 흐름을 짧은 다음 시작으로 연결해 보세요.',
  highlights: [
    { label: '진행 시간', detail: '지금까지의 흐름을 확인했어요.' },
    { label: '리셋', detail: '다음 시작 전에 한 번만 정리해 보세요.' },
    { label: '다음 시도', detail: '부담 없는 단위로 이어 가기 좋아요.' },
  ],
  nextAction: {
    title: '1분 다음 할 일 적기',
    instruction: '바로 할 한 가지를 적고 시작 버튼을 눌러 보세요.',
    durationMinutes: 1,
  },
}

export default class AiReportFixtureProvider {
  id() {
    return 'upright:ai-report-fixture'
  }

  async callApi(_, context) {
    const session = JSON.parse(context.vars.sessionSummary)
    return { output: JSON.stringify(session.status === 'aborted' ? abortedReport : completedReport) }
  }
}

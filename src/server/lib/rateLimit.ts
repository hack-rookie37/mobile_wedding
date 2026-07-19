// /api/rsvp의 IP+slug 단위 슬라이딩 윈도우 제한 — 일반 경로의 1차 방어선 (ADR-021).
// 프로세스 메모리에 계산되므로 인스턴스가 여러 개면 인스턴스별로 적용된다 —
// 내구적 상한은 DB의 프로젝트별 일일 상한(submit_rsvp)이 담당한다.

const PRUNE_THRESHOLD = 10_000; // 키가 이 수를 넘으면 만료 키를 정리한다 (메모리 상한)

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  // now는 주입한다 — 테스트에서 시간 경과를 결정적으로 재현하기 위함
  allow(key: string, now: number): boolean {
    const cutoff = now - this.windowMs;
    if (this.hits.size >= PRUNE_THRESHOLD) {
      for (const [existing, times] of this.hits) {
        if (times.every((t) => t <= cutoff)) this.hits.delete(existing);
      }
    }
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

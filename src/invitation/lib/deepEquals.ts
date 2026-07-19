// JSON 직렬화 가능한 값(문서 트리)의 구조 동등성 비교.
// action 적용 결과가 원본과 동일한지 판정해 no-op을 감지하는 데 사용한다.
export function deepEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEquals(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

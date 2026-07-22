// 카카오 심볼 — 말풍선. 버튼 색에서 정해진 글자색을 그대로 쓴다.
// 공유하기 섹션과 떠 있는 공유 버튼이 같은 심볼을 쓴다.
export function KakaoIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0" fill={color}>
      <path d="M12 3.6c-4.7 0-8.5 2.96-8.5 6.6 0 2.33 1.56 4.38 3.9 5.55l-.86 3.2a.35.35 0 0 0 .53.38l3.83-2.53c.36.03.73.05 1.1.05 4.7 0 8.5-2.96 8.5-6.65S16.7 3.6 12 3.6z" />
    </svg>
  );
}

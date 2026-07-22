// 이모지 표시 정규화.
//
// ☎·✈·❤ 같은 옛 유니코드 기호는 기본 표시가 '글자'라서, 표시 지정자(U+FE0F) 없이 들어오면
// 플랫폼이 작은 흑백 활자로 그린다 — 🚇🚌 같은 컬러 이모지 사이에서 혼자 크기가 어긋난다
// (교통 안내의 '예식장 전화 ☎'가 실제 사례). 키보드·복사 경로에 따라 지정자가 빠진 채
// 저장될 수 있으므로, 그릴 때 붙여서 모든 그림을 같은 컬러 이모지 크기로 맞춘다.
export function withEmojiPresentation(text: string): string {
  const chars = [...text];
  return chars
    .map((char, i) => {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined || codePoint <= 0x7f) return char; // 숫자·#·* 오탐 방지
      if (!/\p{Emoji}/u.test(char)) return char; // 이모지가 아닌 글자는 그대로
      if (/\p{Emoji_Presentation}/u.test(char)) return char; // 이미 기본이 컬러 이모지
      const next = chars[i + 1];
      // 표시 지정자·글자 지정자(U+FE0E)·키캡이 이미 붙어 있으면 고른 그대로 둔다
      if (next === "️" || next === "︎" || next === "⃣") return char;
      return `${char}️`;
    })
    .join("");
}

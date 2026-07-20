// 발행된 청첩장이 없을 때 하객이 보는 화면. 로그인 유도나 편집기 링크를 두지 않는다 —
// 하객에게는 이 사이트에 편집 기능이 있다는 사실 자체가 필요 없다.
export function InvitationNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-[#faf7f1] px-6 text-[#221d16]">
      <p className="text-[16px] font-medium">청첩장을 찾을 수 없습니다</p>
      <p className="text-[13px] opacity-60">주소를 다시 확인해 주세요.</p>
    </main>
  );
}

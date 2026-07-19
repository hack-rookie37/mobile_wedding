import { nanoid } from "nanoid";
import type { InvitationDocument, SectionStyle } from "../schema/document";

export const SAMPLE_PROJECT_TITLE = "민준 · 서연 결혼식";

const style = (
  paddingY: SectionStyle["paddingY"],
  animation: SectionStyle["animation"] = "none",
): SectionStyle => ({
  paddingY,
  animation,
});

// 실제 한국 청첩장 관례를 따른 샘플 문서 (인물·장소는 가상)
export function createSampleDocument(): InvitationDocument {
  return {
    schemaVersion: 6,
    wedding: {
      groom: {
        name: "김민준",
        familyRole: "장남",
        father: { name: "김영호", deceased: false },
        mother: { name: "박정숙", deceased: false },
      },
      bride: {
        name: "이서연",
        familyRole: "차녀",
        father: { name: "이상철", deceased: false },
        mother: { name: "최미경", deceased: false },
      },
      datetime: "2026-11-14T14:00:00+09:00",
      venue: {
        name: "라온컨벤션",
        hall: "3층 그랜드볼룸",
        address: "서울특별시 강남구 테헤란로 132",
        phone: "02-1234-5678",
      },
    },
    theme: { id: "warm-editorial" },
    sections: [
      {
        id: nanoid(),
        type: "hero",
        visible: true,
        layout: { variant: "photoArch" },
        style: style("lg"),
        content: {
          tagline: "THE MARRIAGE OF",
          photoAssetId: "hero-main",
          photoAspect: "3/4",
          fadeBottom: true,
          showDate: true,
          showVenue: true,
        },
      },
      {
        id: nanoid(),
        type: "greeting",
        visible: true,
        layout: { variant: "default" },
        style: style("md", "rise"),
        content: {
          title: "소중한 분들을 초대합니다",
          body: "서로가 마주 보며 다져온 사랑을\n이제 함께 한곳을 바라보며\n걸어갈 수 있는 큰 사랑으로 키우고자 합니다.\n\n저희 두 사람이 사랑의 이름으로\n지켜나갈 수 있도록\n앞날을 축복해 주시면 감사하겠습니다.",
          showParents: true,
          align: "center",
        },
      },
      {
        id: nanoid(),
        type: "coupleProfile",
        visible: true,
        layout: { variant: "sideBySide" },
        style: style("md", "rise"),
        content: {
          title: "신랑과 신부를 소개합니다",
          groom: {
            photoAssetId: "gallery-04",
            intro: "웃음이 많은 사람입니다.\n서연이의 하루를 가장 재밌게 만들어 주고 싶습니다.",
          },
          bride: {
            photoAssetId: "gallery-05",
            intro: "기록하기를 좋아합니다.\n민준이와의 모든 계절을 차곡차곡 담아가겠습니다.",
          },
          showParents: true,
        },
      },
      {
        id: nanoid(),
        type: "calendar",
        visible: true,
        layout: { variant: "grid" },
        style: style("md", "fade"),
        content: { title: "그날을 기다립니다", showDday: true, ddayStyle: "countdown" },
      },
      {
        id: nanoid(),
        type: "gallery",
        visible: true,
        layout: { variant: "grid3" },
        style: style("md", "rise"),
        content: {
          title: "우리의 순간들",
          photoAspect: "3/4",
          photos: [
            { assetId: "gallery-01", alt: "한강 산책 스냅", caption: "한강 산책" },
            { assetId: "gallery-02", alt: "카페에서", caption: "자주 가던 카페" },
            { assetId: "gallery-03", alt: "제주 여행", caption: "제주, 봄" },
            { assetId: "gallery-04", alt: "웨딩 촬영 야외" },
            { assetId: "gallery-05", alt: "웨딩 촬영 스튜디오" },
            { assetId: "gallery-06", alt: "프러포즈하던 날", caption: "그날의 대답은 예" },
          ],
        },
      },
      {
        id: nanoid(),
        type: "venue",
        visible: true,
        layout: { variant: "default" },
        style: style("lg", "fade"),
        content: {
          title: "오시는 길",
          note: "식장 입구가 협소하니 안내 직원의 안내를 따라주세요.",
          mapImageAssetId: null,
          showMapButtons: true,
        },
      },
      {
        id: nanoid(),
        type: "transportation",
        visible: true,
        layout: { variant: "list" },
        style: style("md", "rise"),
        content: {
          title: "교통 안내",
          items: [
            { icon: "subway", title: "지하철", body: "2호선 역삼역 3번 출구에서 도보 5분" },
            { icon: "bus", title: "버스", body: "146 · 341 · 360 역삼역 정류장 하차" },
            {
              icon: "parking",
              title: "주차",
              body: "건물 지하 주차장 2시간 무료\n(로비 안내데스크에서 하객 등록 필요)",
            },
          ],
        },
      },
      {
        id: nanoid(),
        type: "contacts",
        visible: true,
        layout: { variant: "inline" },
        style: style("md", "rise"),
        content: {
          title: "연락하기",
          entries: [
            { side: "groom", label: "신랑", name: "김민준", phone: "010-1234-5678" },
            { side: "groom", label: "아버지", name: "김영호", phone: "010-2345-6789" },
            { side: "bride", label: "신부", name: "이서연", phone: "010-3456-7890" },
            { side: "bride", label: "어머니", name: "최미경", phone: "010-4567-8901" },
          ],
        },
      },
      {
        id: nanoid(),
        type: "giftAccount",
        visible: true,
        layout: { variant: "accordion" },
        style: style("md", "rise"),
        content: {
          title: "마음 전하실 곳",
          groomLabel: "신랑측",
          brideLabel: "신부측",
          accounts: [
            { side: "groom", bank: "국민은행", holder: "김민준", number: "123456-01-234567" },
            { side: "groom", bank: "신한은행", holder: "김영호", number: "110-234-567890" },
            { side: "bride", bank: "우리은행", holder: "이서연", number: "1002-345-678901" },
          ],
        },
      },
      {
        id: nanoid(),
        type: "rsvp",
        visible: true,
        layout: { variant: "default" },
        style: style("md", "rise"),
        content: {
          title: "참석 의사 전달",
          body: "한 분 한 분 소중히 모실 수 있도록\n참석 의사를 미리 전해 주시면 감사하겠습니다.",
          deadline: null,
          collect: { side: true, companions: true, meal: true, phone: true, message: true },
        },
      },
      {
        id: nanoid(),
        type: "closing",
        visible: true,
        layout: { variant: "photo" },
        style: style("lg", "fade"),
        content: {
          title: "감사합니다",
          body: "저희 두 사람의 시작을 함께해 주셔서 감사합니다.\n주신 마음 오래 간직하며 예쁘게 살겠습니다.",
          photoAssetId: "gallery-06",
          showShare: true,
        },
      },
    ],
  };
}

import { nanoid } from "nanoid";
import {
  DEFAULT_ORNAMENT_HEIGHT,
  DEFAULT_SECTION_PAD_X,
  EMPTY_SECTION_TEXT,
  type InvitationDocument,
  type SectionStyle,
} from "../schema/document";
import { DEFAULT_BODY_PT, DEFAULT_HEADING_PT } from "../schema/themes";

export const SAMPLE_PROJECT_TITLE = "정훈 · 은진 결혼식";

const style = (
  paddingY: SectionStyle["paddingY"],
  animation: SectionStyle["animation"] = "none",
  paddingX: number = DEFAULT_SECTION_PAD_X, // 0 = 좌우를 꽉 채운다 (전면 사진)
): SectionStyle => ({
  paddingY,
  paddingX,
  animation,
  text: EMPTY_SECTION_TEXT,
});

// 실제 한국 청첩장 관례를 따른 샘플 문서 (연락처·계좌만 가상)
export function createSampleDocument(): InvitationDocument {
  return {
    schemaVersion: 20,
    wedding: {
      groom: {
        name: "이정훈",
        familyRole: "아들",
        father: { name: "이길재", deceased: false },
        mother: { name: "최은주", deceased: false },
      },
      bride: {
        name: "양은진",
        familyRole: "딸",
        father: { name: "양길모", deceased: false },
        mother: { name: "임현이", deceased: false },
      },
      datetime: "2026-09-19T12:20:00+09:00",
      venue: {
        name: "공군호텔",
        hall: "3층 그랜드볼룸",
        address: "서울 영등포구 여의대방로 259",
        phone: "02-844-0336",
      },
    },
    theme: { id: "warm-editorial", palette: {} },
    music: { assetId: null, volume: 1, speed: 1, autoplay: false },
    typography: {
      roles: {
        // 눈썹은 제목 배율의 11/20, 항목 제목은 본문 배율의 13.5/15 — v12 전의 모습 그대로다
        label: { font: "theme", sizePt: 8.5 },
        heading: { font: "theme", sizePt: DEFAULT_HEADING_PT },
        itemTitle: { font: "theme", sizePt: 10 },
        body: { font: "theme", sizePt: DEFAULT_BODY_PT },
      },
    },
    sections: [
      {
        id: nanoid(),
        type: "hero",
        visible: true,
        layout: { variant: "photoFull" },
        style: style("lg", "none", 0),
        content: {
          tagline: "THE MARRIAGE OF",
          overlay: {
            text: "we're getting married",
            positionPct: 50,
            font: "theme",
            sizePt: 14,
            color: "#ffffff",
            letterSpacing: 0,
            lineHeight: 1.45,
            rotateDeg: 0,
            edgeBlurPx: 0,
            glow: false,
            glowStrength: 40,
            animation: "none",
            animationSpeed: 1,
            shadow: true,
            shadowColor: "#000000",
            shadowStrength: 40,
          },
          contentOffsetPx: 0,
          photoAssetId: "hero-main",
          photoAspect: "3/4",
          effects: {
            fadeBottom: true,
            sparkle: false,
            petals: false,
            petalColor: "#ffd6e0",
            petalCount: 9,
            petalOpacity: 0.9,
            brightness: 1,
            opacity: 1,
          },
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
          label: "INVITATION",
          body: "서로가 마주 보며 다져온 사랑을\n이제 함께 한곳을 바라보며\n걸어갈 수 있는 큰 사랑으로 키우고자 합니다.\n\n저희 두 사람이 사랑의 이름으로\n지켜나갈 수 있도록\n앞날을 축복해 주시면 감사하겠습니다.",
          showParents: true,
          align: "center",
          ornamentAssetId: null,
          ornamentHeightPx: DEFAULT_ORNAMENT_HEIGHT,
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
          label: "COUPLE",
          groom: {
            photoAssetId: "gallery-04",
            intro: "웃음이 많은 사람입니다.\n은진이의 하루를 가장 재밌게 만들어 주고 싶습니다.",
          },
          bride: {
            photoAssetId: "gallery-05",
            intro: "기록하기를 좋아합니다.\n정훈이와의 모든 계절을 차곡차곡 담아가겠습니다.",
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
        content: {
          title: "그날을 기다립니다",
          label: "CALENDAR",
          showDday: true,
          ddayStyle: "countdown",
        },
      },
      {
        id: nanoid(),
        type: "gallery",
        visible: true,
        layout: { variant: "grid3" },
        style: style("md", "rise"),
        content: {
          title: "우리의 순간들",
          label: "GALLERY",
          photoAspect: "3/4",
          photoCorner: "rounded",
          photoGapPx: 6,
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
          label: "LOCATION",
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
          label: "TRANSPORT",
          columns: 2,
          items: [
            {
              icon: "subway",
              emoji: "",
              title: "지하철",
              body: "1호선 대방역 5번 출구 (도보 5분)\n신림선 대방역 6번 출구 (도보 5분)\n7호선 보라매역 7번 출구 (도보 15분)\n신림선 서울지방병무청역 2번 출구 (도보 9분)",
            },
            {
              icon: "bus",
              emoji: "",
              title: "버스",
              body: "간선 : 150, 461, 505, 753\n지선 : 5531, 5534, 5623, 5633, 6514, 6713\n광역 : M5609\n마을 : 영등포07",
            },
            {
              icon: "parking",
              emoji: "",
              title: "주차",
              body: "공군호텔 내 지하주차장 이용 가능\n(예식 하객 기준 3시간 무료주차 제공)\n주차 가능 대수 600~1,000대",
            },
            { icon: "etc", emoji: "", title: "예식장 전화", body: "02-844-0336" },
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
          label: "CONTACT",
          entries: [
            { side: "groom", label: "신랑", name: "이정훈", phone: "010-1234-5678" },
            { side: "groom", label: "아버지", name: "이길재", phone: "010-2345-6789" },
            { side: "bride", label: "신부", name: "양은진", phone: "010-3456-7890" },
            { side: "bride", label: "어머니", name: "임현이", phone: "010-4567-8901" },
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
          label: "REGISTRY",
          groomLabel: "신랑측",
          brideLabel: "신부측",
          accounts: [
            { side: "groom", bank: "국민은행", holder: "이정훈", number: "123456-01-234567" },
            { side: "groom", bank: "신한은행", holder: "이길재", number: "110-234-567890" },
            { side: "bride", bank: "우리은행", holder: "양은진", number: "1002-345-678901" },
          ],
        },
      },
      {
        id: nanoid(),
        type: "rsvp",
        visible: true,
        layout: { variant: "sheet" },
        style: style("md", "rise"),
        content: {
          title: "참석 의사 전달",
          label: "RSVP",
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
        style: style("lg", "fade", 0),
        content: {
          title: "감사합니다",
          label: "",
          body: "저희 두 사람의 시작을 함께해 주셔서 감사합니다.\n주신 마음 오래 간직하며 예쁘게 살겠습니다.",
          photoAssetId: "gallery-06",
          photoAspect: "4/5",
          // 글자가 사진 위에 얹히므로 어둡게 깔고, 하단 페이드는 끈다
          // (사진이 캔버스 맨 아래에 붙는데 바닥이 종이색으로 흐려지면 덜 붙어 보인다)
          effects: {
            fadeBottom: false,
            sparkle: false,
            petals: false,
            petalColor: "#ffd6e0",
            petalCount: 9,
            petalOpacity: 0.9,
            brightness: 0.6,
            opacity: 1,
          },
        },
      },
      {
        id: nanoid(),
        type: "share",
        visible: true,
        layout: { variant: "default" },
        style: style("md", "fade"),
        content: {
          title: "청첩장 공유하기",
          label: "SHARE",
          body: "이 청첩장을 소중한 분들께 전해 주세요.",
        },
      },
    ],
  };
}

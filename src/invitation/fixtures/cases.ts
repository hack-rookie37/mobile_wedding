import type { GallerySection, InvitationDocument } from "../schema/document";
import { createSampleDocument } from "./sample";

// 테마 검증용 엣지 케이스 fixture — /fixture/[theme]/[caseId] 라우트와 e2e 스크린샷에서 사용

export const FIXTURE_CASES = [
  "base",
  "hero-full",
  "gallery-strip",
  "venue-map",
  "typography",
  "long-names",
  "long-greeting",
  "one-photo",
  "ten-photos",
  "missing-image",
  "hidden-section",
  "long-transport",
] as const;

export type FixtureCase = (typeof FIXTURE_CASES)[number];

export function isFixtureCase(value: string): value is FixtureCase {
  return (FIXTURE_CASES as readonly string[]).includes(value);
}

function gallerySectionOf(doc: InvitationDocument): GallerySection {
  const gallery = doc.sections.find((s) => s.type === "gallery");
  if (gallery?.type !== "gallery") {
    throw new Error("샘플 문서에 gallery 섹션이 없습니다");
  }
  return gallery;
}

export function createCaseDocument(kind: FixtureCase): InvitationDocument {
  const doc = createSampleDocument();

  switch (kind) {
    case "base":
      return doc;

    // 전면 사진 효과 — 반짝임 + 밝기·투명도를 낮춘 상태
    case "hero-full": {
      const hero = doc.sections[0];
      if (hero.type !== "hero") throw new Error("hero 섹션이 없습니다");
      hero.content.effects = { fadeBottom: true, sparkle: true, brightness: 0.8, opacity: 0.9 };
      return doc;
    }

    // 대형 스트립 갤러리 — 풀블리드 가로 스냅 (벤치마크 스타일)
    case "gallery-strip": {
      const gallery = gallerySectionOf(doc);
      gallery.layout = { variant: "strip" };
      return doc;
    }

    // 폰트 선택 + 큰 글자 + 섹션별 override (인사말만 고운돋움·작게)
    case "typography": {
      doc.typography = {
        roles: {
          label: { font: "gowun-batang", sizePt: 9.5, letterSpacing: 0.2 },
          heading: { font: "nanum-myeongjo", sizePt: 17 },
          itemTitle: { font: "gowun-batang", sizePt: 11.5, bold: true },
          body: { font: "gowun-batang", sizePt: 13, lineHeight: 1.9 },
        },
      };
      const greeting = doc.sections.find((s) => s.type === "greeting");
      if (greeting?.type !== "greeting") throw new Error("greeting 섹션이 없습니다");
      greeting.style = {
        ...greeting.style,
        text: {
          label: { font: "gowun-dodum" },
          heading: { font: "gowun-dodum", sizePt: 12 },
          itemTitle: { font: "gowun-dodum" },
          body: { font: "gowun-dodum", sizePt: 9, italic: true },
        },
      };
      return doc;
    }

    // 오시는 길 약도 이미지 — 원본 비율 그대로 표시
    case "venue-map": {
      const venue = doc.sections.find((s) => s.type === "venue");
      if (venue?.type !== "venue") throw new Error("venue 섹션이 없습니다");
      venue.content.mapImageAssetId = "gallery-01";
      return doc;
    }

    case "long-names": {
      doc.wedding.groom.name = "남궁현성민";
      doc.wedding.groom.father = { name: "남궁대성", deceased: false };
      doc.wedding.groom.mother = { name: "제갈미란숙", deceased: false };
      doc.wedding.bride.name = "황보아리솔";
      doc.wedding.bride.father = { name: "황보건우진", deceased: true };
      doc.wedding.bride.mother = { name: "선우정임", deceased: false };
      doc.wedding.venue.name = "그랜드센트럴파크컨벤션웨딩센터";
      doc.wedding.venue.hall = "본관 5층 크리스탈 그랜드볼룸 웨스트윙";
      return doc;
    }

    case "long-greeting": {
      const greeting = doc.sections.find((s) => s.type === "greeting");
      if (greeting?.type !== "greeting") throw new Error("greeting 섹션이 없습니다");
      greeting.content.title = "평생을 함께 걸어갈 두 사람이 소중한 분들을 정중히 모십니다";
      greeting.content.body = [
        "십이월의 어느 눈 오던 날, 우연히 같은 우산 아래에서 처음 만난 저희 두 사람은 일곱 번의 계절을 함께 지나며 서로의 가장 가까운 친구이자 가장 든든한 편이 되었습니다.",
        "기쁜 날에는 함께 웃고 힘든 날에는 말없이 곁을 지키며, 사랑이란 결국 서로의 하루를 정성껏 돌보는 일이라는 것을 배웠습니다.",
        "이제 저희는 서로의 남은 모든 계절을 함께 걷기로 약속하려 합니다. 두 사람이 한 가정을 이루는 그 첫걸음에 오래도록 저희를 아껴주신 분들을 모시고 싶습니다.",
        "귀한 걸음 하시어 저희의 시작을 지켜봐 주시고 따뜻한 마음으로 축복해 주시면 더없는 기쁨으로 간직하겠습니다.",
      ].join("\n\n");
      return doc;
    }

    case "one-photo": {
      const gallery = gallerySectionOf(doc);
      gallery.content.photos = gallery.content.photos.slice(0, 1);
      return doc;
    }

    case "ten-photos": {
      const gallery = gallerySectionOf(doc);
      gallery.content.photos = Array.from({ length: 10 }, (_, i) => ({
        assetId: `gallery-${String(i + 1).padStart(2, "0")}`,
        alt: `우리의 순간 ${i + 1}`,
      }));
      return doc;
    }

    case "missing-image": {
      const hero = doc.sections[0];
      if (hero.type !== "hero") throw new Error("hero 섹션이 없습니다");
      hero.content.photoAssetId = "asset-없음-hero";
      const gallery = gallerySectionOf(doc);
      gallery.content.photos[1] = { assetId: "asset-없음-1", alt: "누락된 사진" };
      return doc;
    }

    case "hidden-section": {
      const greeting = doc.sections.find((s) => s.type === "greeting");
      if (greeting?.type !== "greeting") throw new Error("greeting 섹션이 없습니다");
      greeting.visible = false;
      return doc;
    }

    // 좁은 뷰포트(360px)에서 긴 주소·긴 교통 안내가 넘치지 않는지 검증 (Phase 8)
    case "long-transport": {
      doc.wedding.venue.name = "그랜드센트럴파크컨벤션웨딩센터";
      doc.wedding.venue.hall = "본관 5층 크리스탈 그랜드볼룸 웨스트윙 (에스컬레이터 이용)";
      doc.wedding.venue.address =
        "서울특별시 강남구 테헤란로123길 45-67, 그랜드센트럴파크타워 씨동 지하 2층 주차장 입구 옆 (역삼동 123-45번지)";
      const transportation = doc.sections.find((s) => s.type === "transportation");
      if (transportation?.type !== "transportation") {
        throw new Error("transportation 섹션이 없습니다");
      }
      transportation.content.items = [
        {
          icon: "subway",
          emoji: "",
          title: "지하철로 오시는 매우 상세한 안내",
          body: "2호선 역삼역 3번 출구로 나와서 테헤란로 방면으로 350m 직진 후, GS25 편의점이 있는 사거리에서 좌회전하여 200m 직진하면 오른편에 건물 정문이 보입니다. 분당선 선릉역 5번 출구에서도 도보 12분 거리입니다.",
        },
        {
          icon: "bus",
          emoji: "",
          title: "버스",
          body: "간선 146 · 341 · 360 · 740, 지선 3422 · 4319 역삼역.포스코타워 정류장 하차 후 도보 5분\n광역 9404 · 9408 역삼동사무소 정류장 하차 후 도보 8분",
        },
        {
          icon: "parking",
          emoji: "",
          title: "주차 안내 (매우 김)",
          body: "건물 지하 2~5층 주차장 이용 가능하며 예식 당일 2시간 무료입니다. 만차 시 길 건너 공영주차장(테헤란로123길 89)을 이용해 주세요 — 주차권은 로비 안내데스크에서 하객 등록 후 수령하실 수 있습니다.",
        },
      ];
      return doc;
    }
  }
}

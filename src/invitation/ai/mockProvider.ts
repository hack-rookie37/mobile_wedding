import type { AiPromptInput, AiProvider } from "./port";

// 결정적 mock provider — 단위 테스트와 e2e(AI_PROVIDER=mock)가 사용한다.
// 실제 모델 없이 전체 파이프라인(요청 → 검증 → 검토 → 적용)을 재현하며,
// 요청 문구의 키워드로 어떤 제안을 돌려줄지 결정한다. 외부 네트워크 없음.

const REFINED_GREETING =
  "서로의 하루에 스며든 사랑을 이제 하나의 약속으로 맺으려 합니다.\n" +
  "귀한 걸음 하시어 저희의 시작을 축복해 주시면 감사하겠습니다.";

export function buildMockProposal(input: AiPromptInput): unknown {
  const { instruction } = input;
  const sections = input.projection.doc.sections;
  const bySectionType = (type: string) => sections.find((section) => section.type === type);

  // 오류 경로 재현용 트리거 (검증 계층이 실제로 거부하는지 e2e로 확인)
  if (instruction.includes("깨진 응답")) {
    return { nonsense: true };
  }
  if (instruction.includes("과도한 제안")) {
    const hero = bySectionType("hero");
    return {
      summary: "과도한 제안",
      actions: Array.from({ length: 21 }, () => ({
        type: "updateSectionSettings",
        sectionId: hero?.id ?? "unknown",
        patch: { paddingY: "md" },
      })),
    };
  }

  const actions: unknown[] = [];
  const parts: string[] = [];

  const hero = bySectionType("hero");
  const greeting = bySectionType("greeting");

  if (instruction.includes("미니멀") && hero) {
    // 메인은 레이아웃이 하나뿐이라 장식(태그라인)을 덜어내는 쪽으로 제안한다
    actions.push({ type: "updateSectionContent", sectionId: hero.id, patch: { tagline: "" } });
    if (greeting) {
      actions.push({
        type: "updateSectionSettings",
        sectionId: greeting.id,
        patch: { paddingY: "lg" },
      });
    }
    parts.push("첫 화면의 장식을 덜어내 미니멀하게 바꾸고 여백을 넓혔습니다");
  }

  const gallery = bySectionType("gallery");
  if (/필름|따뜻/.test(instruction) && gallery) {
    actions.push({ type: "setSectionVariant", sectionId: gallery.id, variant: "slider" });
    actions.push({ type: "setTheme", themeId: "film-diary" });
    parts.push("갤러리를 슬라이더 레이아웃으로 바꾸고 테마를 필름 다이어리로 제안합니다");
  }

  if (/인사말|다듬/.test(instruction) && greeting) {
    actions.push({
      type: "updateSectionContent",
      sectionId: greeting.id,
      patch: { body: REFINED_GREETING },
    });
    parts.push("인사말을 간결하게 다듬었습니다");
  }

  return {
    summary: parts.length > 0 ? `${parts.join(". ")}.` : "요청에서 적용할 변경을 찾지 못했습니다.",
    actions,
  };
}

export class MockAiProvider implements AiProvider {
  async propose(input: AiPromptInput): Promise<unknown> {
    return buildMockProposal(input);
  }
}

import { z } from "zod";
import { contactSideSchema } from "../schema/document";

// RSVP 게스트 제출 (PRODUCT_SPEC §8, ADR-021)
// 이 스키마가 server-side validation의 단일 소스다 — 게스트 폼과 /api/rsvp가 같은 것을 쓴다.
// 응답은 invitation 문서에 절대 저장되지 않는다 (별도 저장소, 원칙 9).

export const RSVP_LIMITS = {
  guestName: 40,
  phone: 20,
  message: 500,
  companionsMax: 20,
} as const;

export const rsvpMealSchema = z.enum(["yes", "no", "undecided"]);
export type RsvpMeal = z.infer<typeof rsvpMealSchema>;

// 같은 브라우저의 재제출을 '수정'으로 처리하기 위한 클라이언트 토큰 (crypto.randomUUID 등).
// 자유 텍스트가 아니라 식별자 형식만 허용한다.
const CLIENT_TOKEN_PATTERN = /^[0-9a-zA-Z_-]{16,64}$/;

// 공개 주소 형식 — invitation/lib/slug.ts 및 DB check 제약과 동일한 규칙
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export const rsvpSubmissionSchema = z.object({
  // null = 도메인 루트에 발행된 청첩장 (공개 주소를 따로 두지 않았다, ADR-029)
  slug: z.string().regex(SLUG_PATTERN, "잘못된 청첩장 주소입니다").nullable(),
  clientToken: z.string().regex(CLIENT_TOKEN_PATTERN, "잘못된 제출 토큰입니다"),
  guestName: z
    .string()
    .min(1, "성함을 입력해 주세요")
    .max(RSVP_LIMITS.guestName, `성함은 ${RSVP_LIMITS.guestName}자 이내로 입력해 주세요`),
  side: contactSideSchema.nullable(), // null = 폼에서 수집하지 않았거나 선택하지 않음
  attending: z.boolean(),
  companions: z
    .number()
    .int()
    .min(0)
    .max(RSVP_LIMITS.companionsMax, `동반 인원은 최대 ${RSVP_LIMITS.companionsMax}명입니다`)
    .nullable(),
  meal: rsvpMealSchema.nullable(),
  phone: z
    .string()
    .max(RSVP_LIMITS.phone, `연락처는 ${RSVP_LIMITS.phone}자 이내로 입력해 주세요`)
    .regex(/^[0-9+\-\s()]*$/, "연락처는 숫자와 기호(+, -, 괄호)만 입력할 수 있습니다")
    .nullable(),
  message: z
    .string()
    .max(RSVP_LIMITS.message, `메시지는 ${RSVP_LIMITS.message}자 이내로 입력해 주세요`)
    .nullable(),
  consent: z.literal(true, "개인정보 수집·이용 동의가 필요합니다"), // 동의 없이는 접수하지 않는다 (A-16)
});

export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>;

// 한 줄 입력 정규화: NFC + 제어 문자를 공백으로 + 공백 연속 축약 + 양끝 공백 제거
export function normalizeLine(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 여러 줄 입력 정규화: 개행은 보존하고 그 외 제어 문자만 제거
export function normalizeMultiline(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim();
}

// 원본 payload를 정규화한 뒤 검증한다 — 저장·표시·CSV 모두 이 결과를 쓴다.
// 실패 시 ZodError를 던진다 (호출부가 400으로 변환).
export function parseRsvpSubmission(raw: unknown): RsvpSubmission {
  if (typeof raw !== "object" || raw === null) {
    throw new z.ZodError([
      { code: "custom", path: [], message: "제출 형식이 올바르지 않습니다", input: raw },
    ]);
  }
  const record = raw as Record<string, unknown>;
  const line = (value: unknown) => (typeof value === "string" ? normalizeLine(value) : value);
  // 선택 입력은 비어 있으면 null로 통일한다 — ''와 null 두 표현이 저장소에 섞이지 않게
  const optionalLine = (value: unknown) => {
    const normalized = line(value);
    return normalized === "" ? null : normalized;
  };
  const message =
    typeof record.message === "string" ? normalizeMultiline(record.message) : record.message;
  return rsvpSubmissionSchema.parse({
    slug: line(record.slug),
    clientToken: line(record.clientToken),
    guestName: line(record.guestName),
    side: record.side,
    attending: record.attending,
    companions: record.companions,
    meal: record.meal,
    phone: optionalLine(record.phone),
    message: message === "" ? null : message,
    consent: record.consent,
  });
}

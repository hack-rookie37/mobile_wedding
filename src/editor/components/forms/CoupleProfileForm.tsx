"use client";

import type { ContactSide, CoupleProfileSection, ProfileEntry } from "@/invitation/schema/document";
import { FormSection, TextAreaField, TextField, ToggleField } from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";
import { FrameEditor } from "../media/FrameEditor";
import { PhotoPickField } from "./PhotoPickField";
import { PhaseNote } from "./SectionForms";

const SIDE_TITLES: Record<ContactSide, string> = { groom: "신랑", bride: "신부" };

function ProfileEntryFields({
  sectionId,
  side,
  entry,
  onPatchEntry,
}: {
  sectionId: string;
  side: ContactSide;
  entry: ProfileEntry;
  onPatchEntry: (patch: Partial<ProfileEntry>) => void;
}) {
  const dispatch = useEditor((s) => s.dispatch);
  const { resolveAsset } = useAssetLibrary();
  const asset = entry.photoAssetId !== null ? resolveAsset(entry.photoAssetId) : null;

  return (
    <FormSection title={SIDE_TITLES[side]}>
      <PhotoPickField
        label="사진"
        assetId={entry.photoAssetId}
        pickMode={{ kind: "profile", sectionId, side }}
        onRemove={() =>
          dispatch({
            type: "removeAssetReference",
            sectionId,
            slot: { kind: "profilePhoto", side },
          })
        }
      />
      {entry.photoAssetId !== null && (
        <FrameEditor
          asset={asset}
          frame={entry.photoFrame}
          aspectRatio="4 / 5"
          onChange={(photoFrame) => onPatchEntry({ photoFrame })}
        />
      )}
      <TextAreaField
        label="소개 문구"
        value={entry.intro}
        onChange={(intro) => onPatchEntry({ intro })}
        rows={4}
      />
    </FormSection>
  );
}

export function CoupleProfileForm({ section }: { section: CoupleProfileSection }) {
  const dispatch = useEditor((s) => s.dispatch);
  const { content } = section;
  const patch = (p: Record<string, unknown>) =>
    dispatch({ type: "updateSectionContent", sectionId: section.id, patch: p });
  const patchEntry = (side: ContactSide) => (entryPatch: Partial<ProfileEntry>) =>
    patch({ [side]: { ...content[side], ...entryPatch } });

  return (
    <div className="space-y-4">
      <FormSection title="공통">
        <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
        <ToggleField
          label="혼주 표기"
          checked={content.showParents}
          onChange={(showParents) => patch({ showParents })}
        />
        <PhaseNote>이름과 혼주 성함은 왼쪽 ‘기본 정보’에서 수정합니다.</PhaseNote>
      </FormSection>
      <ProfileEntryFields
        sectionId={section.id}
        side="groom"
        entry={content.groom}
        onPatchEntry={patchEntry("groom")}
      />
      <ProfileEntryFields
        sectionId={section.id}
        side="bride"
        entry={content.bride}
        onPatchEntry={patchEntry("bride")}
      />
    </div>
  );
}

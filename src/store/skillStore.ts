import { message } from "antd";
import { create } from "zustand";
import {
  listInstalledSkills,
  listRecognizedSkills,
  removeSkill,
  type InstalledSkillRecord,
  type RecognizedSkillRecord,
} from "~/api";
import { getErrorMessage } from "~/common/utils";

const createSkillSnapshot = (
  installedSkills: InstalledSkillRecord[],
  recognizedSkills: RecognizedSkillRecord[],
) => ({
  installedSkills,
  recognizedSkills,
  installedSkillIds: installedSkills.map((skill) => skill.id),
  recognizedSkillIds: recognizedSkills.map((record) => record.name),
  readySkillIds: recognizedSkills.filter((record) => record.eligible).map((record) => record.name),
});

interface SkillState {
  installedSkillIds: string[];
  installedSkills: InstalledSkillRecord[];
  recognizedSkills: RecognizedSkillRecord[];
  recognizedSkillIds: string[];
  readySkillIds: string[];
  skillOperations: Record<string, "removing">;
  skillOperationError: string | null;
  selectedSkillId: string | null;
  skillDrawerOpen: boolean;
  openSkill: (skillId: string) => void;
  closeSkill: () => void;
  refreshInstalledSkills: () => Promise<{
    records: InstalledSkillRecord[];
    recognized: RecognizedSkillRecord[];
  }>;
  removeInstalledSkill: (skillId: string, skillName: string) => Promise<boolean>;
}

export const useSkillStore = create<SkillState>((set, get) => ({
  installedSkillIds: [],
  installedSkills: [],
  recognizedSkills: [],
  recognizedSkillIds: [],
  readySkillIds: [],
  skillOperations: {},
  skillOperationError: null,
  selectedSkillId: null,
  skillDrawerOpen: false,
  openSkill: (skillId) =>
    set({
      selectedSkillId: skillId,
      skillDrawerOpen: true,
    }),
  closeSkill: () =>
    set({
      skillDrawerOpen: false,
    }),
  refreshInstalledSkills: async () => {
    const [recordsResult, recognizedResult] = await Promise.allSettled([
      listInstalledSkills(),
      listRecognizedSkills(),
    ]);

    if (recordsResult.status !== "fulfilled") {
      throw recordsResult.reason;
    }

    const records = recordsResult.value;
    const recognized = recognizedResult.status === "fulfilled" ? recognizedResult.value : [];

    set({
      ...createSkillSnapshot(records, recognized),
    });

    return { records, recognized };
  },
  removeInstalledSkill: async (skillId, skillName) => {
    const { installedSkillIds, installedSkills, skillOperations, refreshInstalledSkills } = get();

    if (!installedSkillIds.includes(skillId) || skillOperations[skillId]) {
      return false;
    }

    const targetSkill = installedSkills.find((skill) => skill.id === skillId);
    if (!targetSkill?.removable) {
      const errorMessage = "当前技能来自外部本地目录，请直接在原目录中管理，不支持在 Kadaclaw 中删除。";
      set({
        skillOperationError: errorMessage,
      });
      message.error(errorMessage);
      return false;
    }

    set((state) => ({
      skillOperations: {
        ...state.skillOperations,
        [skillId]: "removing",
      },
      skillOperationError: null,
    }));

    try {
      const removed = await removeSkill(skillId);
      if (!removed) {
        throw new Error("目标技能不在 Kadaclaw 托管目录中，无法直接删除。");
      }
      message.success(`已卸载技能：${skillName}`);
      await refreshInstalledSkills();
      return true;
    } catch (reason) {
      const errorMessage = getErrorMessage(reason, "技能操作失败");
      set({
        skillOperationError: errorMessage,
      });
      message.error(errorMessage);
      return false;
    } finally {
      set((state) => {
        const nextOperations = { ...state.skillOperations };
        delete nextOperations[skillId];

        return {
          skillOperations: nextOperations,
        };
      });
    }
  },
}));

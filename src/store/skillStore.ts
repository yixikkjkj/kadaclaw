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
  installedSkillIds: installedSkills.map((skill) => skill.id),
  recognizedSkillIds: recognizedSkills.map((record) => record.name),
  readySkillIds: recognizedSkills.filter((record) => record.eligible).map((record) => record.name),
});

interface SkillState {
  installedSkillIds: string[];
  installedSkills: InstalledSkillRecord[];
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
    const [records, recognized] = await Promise.all([
      listInstalledSkills(),
      listRecognizedSkills(),
    ]);

    set({
      ...createSkillSnapshot(records, recognized),
    });

    return { records, recognized };
  },
  removeInstalledSkill: async (skillId, skillName) => {
    const { installedSkillIds, skillOperations, refreshInstalledSkills } = get();

    if (!installedSkillIds.includes(skillId) || skillOperations[skillId]) {
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
      await removeSkill(skillId);
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

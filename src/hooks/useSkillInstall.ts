import { message } from "antd";
import { useCallback } from "react";
import type { Skill } from "../data/skills";
import {
  installSkill,
  listInstalledSkills,
  listRecognizedSkills,
  removeSkill,
} from "../lib/skills";
import { useAppStore } from "../store/appStore";

export function useSkillInstall() {
  const setInstalledSkillIds = useAppStore((state) => state.setInstalledSkillIds);
  const setRecognizedSkills = useAppStore((state) => state.setRecognizedSkills);
  const installedSkillIds = useAppStore((state) => state.installedSkillIds);
  const recognizedSkillIds = useAppStore((state) => state.recognizedSkillIds);
  const readySkillIds = useAppStore((state) => state.readySkillIds);

  const refreshInstalledSkills = useCallback(async () => {
    const [records, recognized] = await Promise.all([
      listInstalledSkills(),
      listRecognizedSkills(),
    ]);
    setInstalledSkillIds(records.map((record) => record.id));
    setRecognizedSkills(
      recognized.map((record) => record.name),
      recognized.filter((record) => record.eligible).map((record) => record.name),
    );
    return { records, recognized };
  }, [setInstalledSkillIds, setRecognizedSkills]);

  const toggleSkillInstall = useCallback(
    async (skill: Skill) => {
      const installed = installedSkillIds.includes(skill.id);
      if (installed) {
        await removeSkill(skill.id);
        message.success(`已卸载技能：${skill.name}`);
      } else {
        await installSkill(skill);
        message.success(`已安装技能：${skill.name}`);
      }
      await refreshInstalledSkills();
    },
    [installedSkillIds, refreshInstalledSkills],
  );

  return {
    installedSkillIds,
    recognizedSkillIds,
    readySkillIds,
    refreshInstalledSkills,
    toggleSkillInstall,
  };
}

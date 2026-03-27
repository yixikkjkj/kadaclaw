import { message } from "antd";
import { useCallback } from "react";
import { installSkill, type InstallableSkill, listInstalledSkills, listRecognizedSkills, removeSkill } from "~/api";
import { getErrorMessage } from "~/common/utils";
import { useAppStore } from "~/store/appStore";

export function useSkillInstall() {
  const setInstalledSkills = useAppStore((state) => state.setInstalledSkills);
  const setRecognizedSkills = useAppStore((state) => state.setRecognizedSkills);
  const startSkillOperation = useAppStore((state) => state.startSkillOperation);
  const finishSkillOperation = useAppStore((state) => state.finishSkillOperation);
  const setSkillOperationError = useAppStore((state) => state.setSkillOperationError);
  const installedSkillIds = useAppStore((state) => state.installedSkillIds);
  const installedSkills = useAppStore((state) => state.installedSkills);
  const recognizedSkillIds = useAppStore((state) => state.recognizedSkillIds);
  const readySkillIds = useAppStore((state) => state.readySkillIds);
  const skillOperations = useAppStore((state) => state.skillOperations);
  const skillOperationError = useAppStore((state) => state.skillOperationError);

  const refreshInstalledSkills = useCallback(async () => {
    const [records, recognized] = await Promise.all([
      listInstalledSkills(),
      listRecognizedSkills(),
    ]);
    setInstalledSkills(records);
    setRecognizedSkills(
      recognized.map((record) => record.name),
      recognized.filter((record) => record.eligible).map((record) => record.name),
    );
    return { records, recognized };
  }, [setInstalledSkills, setRecognizedSkills]);

  const toggleSkillInstall = useCallback(
    async (skill: InstallableSkill) => {
      const installed = installedSkillIds.includes(skill.id);
      if (skillOperations[skill.id]) {
        return false;
      }
      const action = installed ? "removing" : "installing";
      startSkillOperation(skill.id, action);
      try {
        if (installed) {
          await removeSkill(skill.id);
          message.success(`已卸载技能：${skill.name}`);
        } else {
          await installSkill(skill);
          message.success(`已从 ClawHub 安装技能：${skill.name}`);
        }
        await refreshInstalledSkills();
        setSkillOperationError(null);
        return true;
      } catch (reason) {
        const errorMessage = getErrorMessage(reason, "技能操作失败");
        setSkillOperationError(errorMessage);
        message.error(errorMessage);
        return false;
      } finally {
        finishSkillOperation(skill.id);
      }
    },
    [
      finishSkillOperation,
      installedSkillIds,
      refreshInstalledSkills,
      setSkillOperationError,
      skillOperations,
      startSkillOperation,
    ],
  );

  return {
    installedSkillIds,
    installedSkills,
    recognizedSkillIds,
    readySkillIds,
    skillOperations,
    skillOperationError,
    refreshInstalledSkills,
    toggleSkillInstall,
  };
}

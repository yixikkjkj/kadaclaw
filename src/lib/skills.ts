import { invoke } from "@tauri-apps/api/core";
import type { Skill } from "../data/skills";

export interface InstalledSkillRecord {
  id: string;
  manifestPath: string;
  directory: string;
}

export interface RecognizedSkillRecord {
  name: string;
  description: string;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
}

export function listInstalledSkills() {
  return invoke<InstalledSkillRecord[]>("list_installed_skills");
}

export function listRecognizedSkills() {
  return invoke<RecognizedSkillRecord[]>("list_recognized_skills");
}

export function installSkill(skill: Skill) {
  return invoke<InstalledSkillRecord>("install_skill", {
    payload: {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      summary: skill.summary,
      author: skill.author,
    },
  });
}

export function removeSkill(skillId: string) {
  return invoke<boolean>("remove_skill", {
    skillId,
  });
}

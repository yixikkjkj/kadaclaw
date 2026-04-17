export type SkillSourceType = "bundled" | "local" | "runtime";

export const getSkillCategoryLabel = (
  category: string | undefined,
  sourceType?: SkillSourceType,
) => {
  const normalized = category?.trim();

  if (!normalized) {
    return sourceType === "runtime" ? "系统能力" : "--";
  }

  if (normalized === "Runtime") {
    return "系统能力";
  }

  return normalized;
};

export const getSkillAuthorLabel = (author: string | undefined, sourceType?: SkillSourceType) => {
  const normalized = author?.trim();

  if (!normalized) {
    return sourceType === "runtime" ? "系统提供" : "--";
  }

  if (normalized === "OpenClaw Runtime") {
    return "系统提供";
  }

  return normalized;
};

export const getSkillSourceLabel = (
  sourceLabel: string | undefined,
  sourceType?: SkillSourceType,
) => {
  if (sourceType === "bundled") {
    return "应用内安装";
  }

  if (sourceType === "local") {
    return "本地导入";
  }

  if (sourceType === "runtime") {
    return "自动识别";
  }

  const normalized = sourceLabel?.trim();

  if (!normalized) {
    return "--";
  }

  if (normalized === "应用托管") {
    return "应用内安装";
  }

  if (normalized === "本地目录") {
    return "本地导入";
  }

  if (normalized === "Runtime 识别") {
    return "自动识别";
  }

  return normalized;
};

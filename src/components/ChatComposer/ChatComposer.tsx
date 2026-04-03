import { Sender } from "@ant-design/x";
import { message, Select, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { type InstalledSkillRecord, type OpenClawAuthConfig, saveOpenClawAuthConfig } from "~/api";
import { buildCommercePlaceholder, buildCommercePromptPrefix } from "~/common/ecommerce";
import { OPENCLAW_PROVIDER_OPTIONS } from "~/common/constants";
import { useChatStore, useCommerceContextStore, useRuntimeStore, useSkillStore } from "~/store";
import styles from "./index.css";

const { Text } = Typography;

interface ChatComposerProps {
  authConfig: OpenClawAuthConfig | null;
  onAuthConfigChange: (config: OpenClawAuthConfig) => void;
}

const buildSkillPrompt = (messageContent: string, skill: InstalledSkillRecord) =>
  `请优先使用技能「${skill.name}」（ID: ${skill.id}）处理下面这个请求；如果该技能不适用，请明确说明并继续完成任务。\n\n${messageContent}`;

export const ChatComposer = ({
  authConfig,
  onAuthConfigChange,
}: ChatComposerProps) => {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingStopping = useChatStore((state) => state.streamingStopping);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setChatError = useChatStore((state) => state.setChatError);
  const stopStreamingMessage = useChatStore((state) => state.stopStreamingMessage);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const selectedPlatform = useCommerceContextStore((state) => state.selectedPlatform);
  const selectedScene = useCommerceContextStore((state) => state.selectedScene);
  const selectedObject = useCommerceContextStore((state) => state.selectedObject);
  const selectedRange = useCommerceContextStore((state) => state.selectedRange);
  const draftMessage = useCommerceContextStore((state) => state.draftMessage);
  const draftVersion = useCommerceContextStore((state) => state.draftVersion);
  const clearDraftMessage = useCommerceContextStore((state) => state.clearDraftMessage);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState(authConfig?.model ?? "");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [savingModel, setSavingModel] = useState(false);
  const readySkills = installedSkills.filter((skill) => readySkillIds.includes(skill.id));

  useEffect(() => {
    setSelectedModel(authConfig?.model ?? "");
  }, [authConfig?.model]);

  useEffect(() => {
    if (draftMessage) {
      setInputValue(draftMessage);
      clearDraftMessage();
    }
  }, [clearDraftMessage, draftMessage, draftVersion]);

  const promptPrefix = useMemo(
    () =>
      buildCommercePromptPrefix({
        platform: selectedPlatform,
        scene: selectedScene,
        target: selectedObject,
        range: selectedRange,
      }),
    [selectedObject, selectedPlatform, selectedRange, selectedScene],
  );

  const placeholder = useMemo(
    () =>
      buildCommercePlaceholder({
        platform: selectedPlatform,
        scene: selectedScene,
      }),
    [selectedPlatform, selectedScene],
  );

  const modelOptions = useMemo(() => {
    const options = OPENCLAW_PROVIDER_OPTIONS.map((item) => ({
      label: `${item.label} · ${item.model}`,
      value: item.model,
    }));

    if (authConfig?.model && !options.some((item) => item.value === authConfig.model)) {
      options.unshift({
        label: `当前模型 · ${authConfig.model}`,
        value: authConfig.model,
      });
    }

    return options;
  }, [authConfig?.model]);

  const readySkillOptions = useMemo(
    () =>
      readySkills.map((skill) => ({
        label: `${skill.name} · ${skill.category}`,
        value: skill.id,
      })),
    [readySkills],
  );

  const runtimeStatusLabel = useMemo(() => {
    if (streamingRunning) {
      return "回复中";
    }

    switch (runtimeStatus) {
      case "ready":
        return "已连接";
      case "checking":
        return "连接中";
      case "error":
        return "连接异常";
      default:
        return "未连接";
    }
  }, [runtimeStatus, streamingRunning]);

  const selectedSkill = readySkills.find((skill) => skill.id === selectedSkillId) ?? null;
  const canInteract = runtimeStatus === "ready" || streamingRunning;
  const senderLoading = streamingRunning;

  const handleModelChange = async (nextModel: string) => {
    const providerConfig =
      OPENCLAW_PROVIDER_OPTIONS.find((item) => item.model === nextModel) ??
      OPENCLAW_PROVIDER_OPTIONS.find((item) => item.value === authConfig?.provider);

    if (!providerConfig) {
      message.error("未找到可用的 Provider 配置");
      return;
    }

    setSelectedModel(nextModel);
    setSavingModel(true);

    try {
      const saved = await saveOpenClawAuthConfig({
        provider: providerConfig.value,
        model: nextModel,
        apiKey: "",
      });
      onAuthConfigChange(saved);
    } catch (reason) {
      setSelectedModel(authConfig?.model ?? "");
      message.error(reason instanceof Error ? reason.message : "更新模型失败");
    } finally {
      setSavingModel(false);
    }
  };

  const handleSubmit = (messageContent: string) => {
    const trimmedMessage = messageContent.trim();

    if (!trimmedMessage || streamingRunning) {
      return;
    }

    const contextualMessage = promptPrefix
      ? `${promptPrefix}\n\n用户请求：${trimmedMessage}`
      : trimmedMessage;

    const payload = selectedSkill
      ? buildSkillPrompt(contextualMessage, selectedSkill)
      : contextualMessage;

    setInputValue("");
    setChatError(null);
    void sendMessage(payload);
  };

  const handleCancel = async () => {
    if (!streamingRunning || streamingStopping) {
      return;
    }

    await stopStreamingMessage();
  };

  return (
    <Sender
      className={styles.sender}
      value={inputValue}
      onChange={(value) => setInputValue(value)}
      onSubmit={handleSubmit}
      loading={senderLoading}
      onCancel={() => void handleCancel()}
      submitType="enter"
      disabled={!canInteract}
      placeholder={placeholder || "输入你的问题，Enter 发送，Shift + Enter 换行"}
      autoSize={{ minRows: 3, maxRows: 6 }}
      skill={
        selectedSkill
          ? {
              value: selectedSkill.id,
              title: `Skill · ${selectedSkill.name}`,
              closable: {
                onClose: (event) => {
                  event.stopPropagation();
                  setSelectedSkillId(null);
                },
              },
            }
          : undefined
      }
      footer={
        <div className={styles.footer}>
          <Select
            className={styles.control}
            value={selectedModel || undefined}
            options={modelOptions}
            onChange={(value) => void handleModelChange(value)}
            placeholder="选择模型"
            disabled={streamingRunning}
            loading={savingModel}
          />
          <Select
            allowClear
            className={styles.control}
            value={selectedSkillId ?? undefined}
            options={readySkillOptions}
            onChange={(value) => setSelectedSkillId(value)}
            placeholder="自动选择 skill"
            disabled={streamingRunning || readySkillOptions.length === 0}
          />
        </div>
      }
    />
  );
};

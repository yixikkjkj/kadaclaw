import { Sender } from "@ant-design/x";
import { Button, message, Select, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { type InstalledSkillRecord, saveOpenClawAuthConfig } from "~/api";
import { OPENCLAW_PROVIDER_OPTIONS } from "~/common/constants";
import { useChatStore, useRuntimeStore, useSkillStore } from "~/store";
import styles from "./index.css";

const { Text } = Typography;

const buildSkillPrompt = (messageContent: string, skill: InstalledSkillRecord) =>
  `请优先使用技能「${skill.name}」（ID: ${skill.id}）处理下面这个请求；如果该技能不适用，请明确说明并继续完成任务。\n\n${messageContent}`;

export const ChatComposer = () => {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const authConfig = useRuntimeStore((state) => state.authConfig);
  const authConfigLoaded = useRuntimeStore((state) => state.authConfigLoaded);
  const refreshAuthConfig = useRuntimeStore((state) => state.refreshAuthConfig);
  const setAuthConfig = useRuntimeStore((state) => state.setAuthConfig);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingStopping = useChatStore((state) => state.streamingStopping);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setChatError = useChatStore((state) => state.setChatError);
  const stopStreamingMessage = useChatStore((state) => state.stopStreamingMessage);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState(authConfig?.model ?? "");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [savingModel, setSavingModel] = useState(false);
  const readySkills = installedSkills.filter((skill) => readySkillIds.includes(skill.id));

  useEffect(() => {
    if (authConfigLoaded) {
      return;
    }

    void refreshAuthConfig();
  }, [authConfigLoaded, refreshAuthConfig]);

  useEffect(() => {
    setSelectedModel(authConfig?.model ?? "");
  }, [authConfig?.model]);

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

  const selectedSkill = readySkills.find((skill) => skill.id === selectedSkillId) ?? null;
  const canInteract = runtimeStatus === "ready" || streamingRunning;
  const senderLoading = streamingRunning;
  const promptHint = selectedSkill
    ? `当前优先调用 ${selectedSkill.name}`
    : "直接描述目标、限制条件或想调用的技能";

  const handleModelChange = async (nextModel: string) => {
    const providerConfig =
      authConfig?.provider === "custom"
        ? OPENCLAW_PROVIDER_OPTIONS.find((item) => item.value === "custom")
        : OPENCLAW_PROVIDER_OPTIONS.find((item) => item.model === nextModel) ??
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
        apiBaseUrl: authConfig?.provider === "custom" ? authConfig.apiBaseUrl ?? "" : "",
      });
      setAuthConfig(saved);
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

    const payload = selectedSkill
      ? buildSkillPrompt(trimmedMessage, selectedSkill)
      : trimmedMessage;

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
    <div className={styles.senderDock}>
      <div className={styles.senderMetaBar}>
        <div className={styles.senderMetaGroup}>
          <Text className={styles.senderLabel}>Mode</Text>
          <Tag bordered={false} className={styles.senderTag}>
            {streamingRunning ? "Running" : "Ready"}
          </Tag>
          {selectedSkill ? (
            <Tag bordered={false} className={styles.senderTagAccent}>
              Skill · {selectedSkill.name}
            </Tag>
          ) : null}
        </div>
        <Text className={styles.senderHint}>{promptHint}</Text>
      </div>

      <Sender
        className={styles.sender}
        value={inputValue}
        onChange={(value) => setInputValue(value)}
        onSubmit={handleSubmit}
        loading={senderLoading}
        onCancel={() => void handleCancel()}
        submitType="enter"
        disabled={!canInteract}
        placeholder="Ask anything about your task"
        autoSize={{ minRows: 3, maxRows: 7 }}
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
            <div className={styles.footerControls}>
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
                placeholder="选择 skill"
                disabled={streamingRunning || readySkillOptions.length === 0}
              />
            </div>
            <div className={styles.footerActions}>
              <Text className={styles.footerTip}>Enter 发送</Text>
              <Text className={styles.footerTip}>Shift + Enter 换行</Text>
              {streamingRunning ? (
                <Button size="small" onClick={() => void handleCancel()} loading={streamingStopping}>
                  停止
                </Button>
              ) : null}
            </div>
          </div>
        }
      />
    </div>
  );
};

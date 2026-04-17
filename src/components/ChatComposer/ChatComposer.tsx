import { Sender } from "@ant-design/x";
import { Button, Select, Tag, Typography } from "antd";
import { useRef, useState } from "react";
import { type InstalledSkillRecord } from "~/api";
import { useChatStore, useRuntimeStore, useSkillStore } from "~/store";
import styles from "./index.css";

const { Text } = Typography;

const buildSkillPrompt = (messageContent: string, skill: InstalledSkillRecord) =>
  `请优先使用技能「${skill.name}」（ID: ${skill.id}）处理下面这个请求；如果该技能不适用，请明确说明并继续完成任务。\n\n${messageContent}`;

const isImeConfirmEvent = (event: React.KeyboardEvent) => {
  const nativeEvent = event.nativeEvent as KeyboardEvent & {
    isComposing?: boolean;
    keyCode?: number;
    which?: number;
  };

  return (
    nativeEvent.isComposing === true || nativeEvent.keyCode === 229 || nativeEvent.which === 229
  );
};

export const ChatComposer = () => {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingStopping = useChatStore((state) => state.streamingStopping);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setChatError = useChatStore((state) => state.setChatError);
  const stopStreamingMessage = useChatStore((state) => state.stopStreamingMessage);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const senderRef = useRef<React.ElementRef<typeof Sender> | null>(null);
  const inputValueRef = useRef("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const readySkills = installedSkills.filter((skill) => readySkillIds.includes(skill.id));

  const readySkillOptions = readySkills.map((skill) => ({
    label: `${skill.name} · ${skill.category}`,
    value: skill.id,
  }));

  const selectedSkill = readySkills.find((skill) => skill.id === selectedSkillId) ?? null;
  const canInteract = runtimeStatus === "ready" || streamingRunning;
  const senderLoading = streamingRunning;
  const senderPlaceholder = selectedSkill
    ? `直接描述目标、限制条件或想调用的技能。当前优先调用 ${selectedSkill.name}`
    : "直接描述目标、限制条件或想调用的技能";

  const restoreComposerCursor = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        senderRef.current?.focus({ cursor: "end", preventScroll: true });
      });
    });
  };

  const handleSubmit = (messageContent: string) => {
    const nextValue = messageContent || inputValueRef.current;
    const trimmedMessage = nextValue.trim();

    if (!trimmedMessage || streamingRunning) {
      return;
    }

    const payload = selectedSkill
      ? buildSkillPrompt(trimmedMessage, selectedSkill)
      : trimmedMessage;

    inputValueRef.current = "";
    senderRef.current?.clear();
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
          <Tag className={styles.senderTag}>{streamingRunning ? "Running" : "Ready"}</Tag>
          {selectedSkill ? (
            <Tag className={styles.senderTagAccent}>Skill · {selectedSkill.name}</Tag>
          ) : null}
        </div>
      </div>

      <Sender
        ref={senderRef}
        className={styles.sender}
        onChange={(value, _event, _slotConfig, skill) => {
          inputValueRef.current = value;
          setSelectedSkillId(typeof skill?.value === "string" ? skill.value : null);
        }}
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && isImeConfirmEvent(event)) {
            return false;
          }

          return undefined;
        }}
        loading={senderLoading}
        onCancel={() => void handleCancel()}
        submitType="enter"
        disabled={!canInteract}
        placeholder={senderPlaceholder}
        autoSize={{ minRows: 3, maxRows: 7 }}
        skill={
          selectedSkill
            ? {
                value: selectedSkill.id,
                title: `技能 · ${selectedSkill.name}`,
                closable: {
                  onClose: (event) => {
                    event.stopPropagation();
                    setSelectedSkillId(null);
                    restoreComposerCursor();
                  },
                },
              }
            : undefined
        }
        footer={
          <div className={styles.footer}>
            <div className={styles.footerControls}>
              <Select
                allowClear
                className={styles.control}
                value={selectedSkillId ?? undefined}
                options={readySkillOptions}
                onChange={(value) => {
                  setSelectedSkillId(value);
                  restoreComposerCursor();
                }}
                placeholder="选择技能（可选）"
                disabled={streamingRunning || readySkillOptions.length === 0}
              />
            </div>
            <div className={styles.footerActions}>
              <Text className={styles.footerTip}>Enter 发送</Text>
              <Text className={styles.footerTip}>Shift + Enter 换行</Text>
              {streamingRunning ? (
                <Button
                  size="small"
                  onClick={() => void handleCancel()}
                  loading={streamingStopping}
                >
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

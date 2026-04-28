import { Button, Card, Flex, Input, Typography } from "antd";
import { useEffect, useState } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "~/common/constants";
import styles from "./index.css";

const { Text } = Typography;

interface SystemPromptSectionProps {
  value: string;
  loading: boolean;
  onSave: (value: string) => Promise<void>;
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const SystemPromptSection = ({
  value,
  loading,
  onSave,
}: SystemPromptSectionProps) => {
  const [localValue, setLocalValue] = useState(value);
  const isDirty = localValue !== value;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = async () => {
    await onSave(localValue);
  };

  const handleRestoreDefault = () => {
    setLocalValue(DEFAULT_SYSTEM_PROMPT);
  };

  return (
    <Card title="系统提示词">
      <Flex vertical gap={12}>
        <Text type="secondary">
          系统提示词会在每次对话开始前注入，用于定义 Agent
          的行为和角色。修改后下次对话生效。
        </Text>
        <Input.TextArea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          autoSize={{ minRows: 6, maxRows: 20 }}
          placeholder={DEFAULT_SYSTEM_PROMPT}
        />
        <Flex justify="space-between" align="center">
          <Text type="secondary" className={styles.tokenHint}>
            约 {estimateTokens(localValue)} tokens
          </Text>
          <Flex gap={8}>
            <Button size="small" onClick={handleRestoreDefault}>
              恢复默认
            </Button>
            <Button
              type="primary"
              size="small"
              loading={loading}
              disabled={!isDirty}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
};

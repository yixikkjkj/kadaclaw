import { Button, Flex, Modal, Typography } from "antd";
import styles from "./index.css";

const { Paragraph, Text } = Typography;

interface OnboardingModalProps {
  open: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

export function OnboardingModal({
  open,
  onFinish,
  onSkip,
}: OnboardingModalProps) {
  return (
    <Modal
      open={open}
      closable={false}
      footer={null}
      width={560}
      title="欢迎使用 Kadaclaw"
    >
      <Flex vertical gap={20}>
        <Paragraph style={{ marginBottom: 0 }}>
          在开始使用之前，请先前往设置页配置你的 AI 模型 Provider 和 API
          Key。配置完成后即可直接进入聊天工作台。
        </Paragraph>

        <Flex vertical gap={8} className={styles.steps}>
          <Text>
            1. 前往设置页，选择你的模型 Provider，如
            OpenAI、DeepSeek、Anthropic。
          </Text>
          <Text>2. 填写对应的 API Key 并保存。</Text>
          <Text>3. 返回聊天工作台，开始使用。</Text>
        </Flex>

        <Flex gap={8} wrap>
          <Button type="primary" size="large" onClick={onFinish}>
            前往设置页
          </Button>
          <Button size="large" onClick={onSkip}>
            稍后再说
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}

import { Badge, Button, Card, Modal, Space, Typography } from "antd";

const { Paragraph, Text } = Typography;

interface OnboardingModalProps {
  open: boolean;
  runtimeStatus: "idle" | "checking" | "ready" | "error";
  runtimeMessage: string;
  loading: boolean;
  onInstall: () => void;
  onStart: () => void;
  onAdvanced: () => void;
}

export function OnboardingModal({
  open,
  runtimeStatus,
  runtimeMessage,
  loading,
  onInstall,
  onStart,
  onAdvanced,
}: OnboardingModalProps) {
  return (
    <Modal
      open={open}
      closable={false}
      maskClosable={false}
      footer={null}
      width={760}
      title="首次启动"
    >
      <Space direction="vertical" size={20} style={{ display: "flex" }}>
        <Paragraph style={{ marginBottom: 0 }}>
          Kadaclaw 的目标是自带 OpenClaw，不要求用户先手工部署 runtime。
          如果当前还没有可用环境，可以直接在这里完成安装或启动。
        </Paragraph>
        <Card className="inner-card">
          <Space direction="vertical" size={10} style={{ display: "flex" }}>
            <Badge
              status={
                runtimeStatus === "ready"
                  ? "success"
                  : runtimeStatus === "checking"
                    ? "processing"
                    : "error"
              }
              text={runtimeMessage}
            />
            <Text type="secondary">
              安装目标目录：
              `/Users/zfp/Library/Application Support/com.kadaclaw.app/openclaw-runtime`
            </Text>
          </Space>
        </Card>
        <Space wrap>
          <Button type="primary" size="large" loading={loading} onClick={onInstall}>
            一键安装并启动 OpenClaw
          </Button>
          <Button size="large" loading={loading} onClick={onStart}>
            仅启动已安装 Runtime
          </Button>
          <Button size="large" onClick={onAdvanced}>
            高级配置
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}

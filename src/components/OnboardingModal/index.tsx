import { Alert, Badge, Button, Card, Flex, Modal, Typography } from "antd";
import styles from "./index.css";

const { Paragraph, Text } = Typography;

function isWindowsHost() {
  return typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);
}

interface OnboardingModalProps {
  open: boolean;
  runtimeStatus: "idle" | "checking" | "ready" | "error";
  runtimeMessage: string;
  installDir?: string | null;
  loading: boolean;
  onInstall: () => void;
  onStart: () => void;
  onAdvanced: () => void;
}

export function OnboardingModal({
  open,
  runtimeStatus,
  runtimeMessage,
  installDir,
  loading,
  onInstall,
  onStart,
  onAdvanced,
}: OnboardingModalProps) {
  const windowsHost = isWindowsHost();

  return (
    <Modal
      open={open}
      closable={false}
      footer={null}
      width={760}
      title="首次启动"
    >
      <Flex vertical gap={20}>
        <Paragraph style={{ marginBottom: 0 }}>
          Kadaclaw 的目标是自带 OpenClaw，不要求用户先手工部署 runtime。
          如果当前还没有可用环境，可以直接在这里完成安装或启动。
        </Paragraph>
        <Card className={styles.innerCard}>
          <Flex vertical gap={10}>
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
              <Text code>{installDir ?? "<应用本地数据目录>/openclaw-runtime"}</Text>
            </Text>
          </Flex>
        </Card>
        {windowsHost ? (
          <Alert
            type="info"
            showIcon
            title="Windows 兼容提示"
            description="当前已支持 Windows 安装，但如果原生环境下出现安装或启动异常，优先考虑在 WSL2 中安装和运行 OpenClaw。"
          />
        ) : null}
        <Flex gap={8} wrap>
          <Button type="primary" size="large" loading={loading} onClick={onInstall}>
            一键安装并启动 OpenClaw
          </Button>
          <Button size="large" loading={loading} onClick={onStart}>
            仅启动已安装 Runtime
          </Button>
          <Button size="large" onClick={onAdvanced}>
            高级配置
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}

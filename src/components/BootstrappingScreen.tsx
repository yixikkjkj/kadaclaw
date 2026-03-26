import { Card, Progress, Space, Spin, Typography } from "antd";

const { Text, Title } = Typography;

interface BootstrappingScreenProps {
  runtimeMessage: string;
  runtimeStatus: "idle" | "checking" | "ready" | "error";
}

export function BootstrappingScreen({
  runtimeMessage,
  runtimeStatus,
}: BootstrappingScreenProps) {
  return (
    <Card className="hero-card bootstrap-card">
      <Space direction="vertical" size={16} style={{ display: "flex" }}>
        <Spin />
        <Title level={3} style={{ margin: 0 }}>
          正在准备内置 OpenClaw
        </Title>
        <Text type="secondary">{runtimeMessage}</Text>
        <Progress
          percent={runtimeStatus === "ready" ? 100 : runtimeStatus === "checking" ? 68 : 32}
          showInfo={false}
          strokeColor="#0f7b6c"
          trailColor="#d9e6df"
        />
      </Space>
    </Card>
  );
}

import { Card, Flex, Progress, Spin, Typography } from "antd";
import * as styles from "~/common/ui.css";

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
    <Card className={[styles.heroCard, styles.bootstrapCard].join(" ")}>
      <Flex vertical gap={16}>
        <Spin />
        <Text type="secondary">{runtimeMessage}</Text>
        <Progress
          percent={runtimeStatus === "ready" ? 100 : runtimeStatus === "checking" ? 68 : 32}
          showInfo={false}
          strokeColor="#0f7b6c"
          trailColor="#d9e6df"
        />
      </Flex>
    </Card>
  );
}

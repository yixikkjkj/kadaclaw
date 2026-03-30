import { Card, Flex, Progress, Spin, Typography } from "antd";
import styles from "./index.css";

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
    <Card className={styles.bootstrapCard}>
      <Flex vertical gap={16}>
        <Spin />
        <Text type="secondary">{runtimeMessage}</Text>
        <Progress
          percent={runtimeStatus === "ready" ? 100 : runtimeStatus === "checking" ? 68 : 32}
          showInfo={false}
          strokeColor="#0f7b6c"
        />
      </Flex>
    </Card>
  );
}

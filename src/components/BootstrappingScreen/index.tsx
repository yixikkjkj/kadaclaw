import { Flex, Progress, Spin, Typography } from "antd";
import { getRuntimeProgressPercent } from "~/common/runtime";
import { useRuntimeStore } from "~/store";

const { Text } = Typography;

export const BootstrappingScreen = () => {
  const runtimeMessage = useRuntimeStore((state) => state.runtimeMessage);
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  return (
    <Flex style={{ width: "100vw", height: "100vh" }} align="center" justify="center">
      <Flex vertical gap={16} style={{ width: 400 }} align="center" justify="center">
        <Spin />
        <Text type="secondary">{runtimeMessage}</Text>
        <Progress showInfo={false} percent={getRuntimeProgressPercent(runtimeStatus)} />
      </Flex>
    </Flex>
  );
};

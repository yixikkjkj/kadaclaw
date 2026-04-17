import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Flex, Typography } from "antd";
import { type MouseEvent } from "react";
import { getRuntimeLabel } from "~/common/runtime";
import { useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Text } = Typography;

export const WindowTitleBar = () => {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const isDesktopShell = isTauri();

  const runtimeLabel = getRuntimeLabel(runtimeStatus);
  const handleStartDragging = async (event: MouseEvent<HTMLElement>) => {
    if (!isDesktopShell || event.button !== 0) {
      return;
    }

    await getCurrentWindow().startDragging();
  };

  return (
    <Flex align="center" gap={8} className={styles.wrapper} onMouseDown={handleStartDragging}>
      <Text>{runtimeLabel}</Text>
    </Flex>
  );
};

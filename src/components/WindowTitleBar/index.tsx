import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { MenuUnfoldOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Tooltip, Typography } from "antd";
import { type MouseEvent } from "react";
import { useChatStore, useLayoutStore, useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Text } = Typography;

const getRuntimeLabel = (runtimeStatus: "idle" | "checking" | "ready" | "error") => {
  if (runtimeStatus === "ready") {
    return "Runtime 已就绪";
  }
  if (runtimeStatus === "checking") {
    return "Runtime 检测中";
  }
  if (runtimeStatus === "error") {
    return "Runtime 异常";
  }

  return "Runtime 待启动";
};

export const WindowTitleBar = () => {
  const collapseSidebar = useLayoutStore((state) => state.collapseSidebar);
  const toggleCollapseSidebar = useLayoutStore((state) => state.toggleCollapseSidebar);
  const createSession = useChatStore((state) => state.createSession);
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
      {collapseSidebar ? (
        <>
          <Tooltip title="展开侧边栏">
            <Button
              size="small"
              shape="circle"
              icon={<MenuUnfoldOutlined />}
              onClick={toggleCollapseSidebar}
              onMouseDown={(event) => event.stopPropagation()}
            />
          </Tooltip>
          <Tooltip title="新对话">
            <Button
              size="small"
              shape="circle"
              icon={<PlusOutlined />}
              onClick={createSession}
              onMouseDown={(event) => event.stopPropagation()}
            />
          </Tooltip>
        </>
      ) : null}
      <Text>{runtimeLabel}</Text>
    </Flex>
  );
};

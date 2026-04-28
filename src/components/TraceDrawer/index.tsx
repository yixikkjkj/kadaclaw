import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Drawer, Flex, Space, Typography } from "antd";
import { type ChatSession } from "~/types";
import styles from "./index.css";

const { Text, Title } = Typography;

interface TraceDrawerProps {
  open: boolean;
  session: ChatSession | null;
  onClose: () => void;
}

const renderMessageIcon = (role: string) => {
  if (role === "user") return <UserOutlined className={styles.iconUser} />;
  if (role === "system") return <ToolOutlined className={styles.iconTool} />;
  return <RobotOutlined className={styles.iconAssistant} />;
};

const getRoleLabel = (role: string) => {
  if (role === "user") return "用户";
  if (role === "system") return "工具";
  if (role === "assistant") return "助手";
  return role;
};

const extractToolDuration = (
  content: string,
): { name: string; duration: string | null } | null => {
  const match = /^\*\*(.+?)\*\*(?:\s*\((\d+ms)\))?/.exec(content);
  if (!match) return null;
  return { name: match[1], duration: match[2] ?? null };
};

export const TraceDrawer = ({ open, session, onClose }: TraceDrawerProps) => {
  const messages = session?.messages ?? [];
  const totalCount = messages.length;

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <Title level={5} style={{ margin: 0 }}>
            Trace
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {session?.title ?? "—"}
          </Text>
        </Flex>
      }
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
    >
      <div className={styles.traceContainer}>
        {totalCount === 0 ? (
          <Text type="secondary">暂无消息记录。</Text>
        ) : (
          messages.map((msg, index) => {
            const isSystem = msg.role === "system";
            const toolInfo =
              isSystem && typeof msg.content === "string"
                ? extractToolDuration(msg.content)
                : null;
            const contentText =
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content);

            return (
              <div key={msg.id} className={styles.traceRow}>
                <div className={styles.traceIndex}>{index + 1}</div>
                <div className={styles.traceBody}>
                  <Flex
                    align="center"
                    justify="space-between"
                    className={styles.traceHeader}
                  >
                    <Space size={6}>
                      {renderMessageIcon(msg.role)}
                      <Text strong className={styles.traceRole}>
                        {toolInfo ? toolInfo.name : getRoleLabel(msg.role)}
                      </Text>
                    </Space>
                    {toolInfo?.duration ? (
                      <Text className={styles.traceDuration}>
                        {toolInfo.duration}
                      </Text>
                    ) : null}
                    {isSystem && !toolInfo ? (
                      <CheckCircleOutlined className={styles.iconSuccess} />
                    ) : null}
                  </Flex>
                  <Text className={styles.traceContent}>
                    {toolInfo
                      ? contentText.replace(
                          /^\*\*[^*]+\*\*(?:\s*\(\d+ms\))?\s*\n\n/,
                          "",
                        )
                      : contentText}
                  </Text>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Drawer>
  );
};

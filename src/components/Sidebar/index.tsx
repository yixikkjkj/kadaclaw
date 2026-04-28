import {
  AppstoreOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  MessageOutlined,
  OrderedListOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Button,
  Flex,
  Layout,
  Menu,
  MenuProps,
  Popconfirm,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import styles from "./index.css";
import { useChatStore } from "~/store";

const { Sider } = Layout;
const { Text } = Typography;

const buildChatMenuItem = (
  sessionId: string,
  title: string,
  onDelete: (sessionId: string) => void,
) => ({
  key: `chat:${sessionId}`,
  icon: <MessageOutlined />,
  label: (
    <Flex align="center" className={styles.chatItem} gap={8}>
      <Text ellipsis style={{ flex: 1 }}>
        {title}
      </Text>
      <Popconfirm
        title="删除这个会话？"
        description="本地保存的该会话记录会一并删除。"
        okText="删除"
        cancelText="取消"
        onConfirm={() => {
          onDelete(sessionId);
        }}
      >
        <Button
          className={styles.deleteButton}
          icon={<DeleteOutlined />}
          size="small"
          type="text"
          onClick={(event) => event.stopPropagation()}
        />
      </Popconfirm>
    </Flex>
  ),
});

export const Sidebar = () => {
  const activeChatSessionId = useChatStore(
    (state) => state.activeChatSessionId,
  );
  const chatSessions = useChatStore((state) => state.chatSessions);
  const activateSession = useChatStore((state) => state.activateSession);
  const createSession = useChatStore((state) => state.createSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const location = useLocation();
  const navigate = useNavigate();
  const sortedChatSessions = [...chatSessions].sort(
    (left, right) =>
      dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf(),
  );

  const now = dayjs();
  const todayStart = now.startOf("day");
  const sevenDaysAgo = todayStart.subtract(7, "day");
  const monthStart = now.startOf("month");
  const sessionGroups = sortedChatSessions.reduce(
    (groups, session) => {
      const updatedAt = dayjs(session.updatedAt);

      if (!updatedAt.isValid()) {
        groups.earlier.push(session);
        return groups;
      }

      if (updatedAt.isSame(now, "day")) {
        groups.today.push(session);
        return groups;
      }

      if (
        updatedAt.valueOf() >= sevenDaysAgo.valueOf() &&
        updatedAt.valueOf() < todayStart.valueOf()
      ) {
        groups.lastSevenDays.push(session);
        return groups;
      }

      if (updatedAt.valueOf() >= monthStart.valueOf()) {
        groups.thisMonth.push(session);
        return groups;
      }

      groups.earlier.push(session);
      return groups;
    },
    {
      today: [] as typeof sortedChatSessions,
      lastSevenDays: [] as typeof sortedChatSessions,
      thisMonth: [] as typeof sortedChatSessions,
      earlier: [] as typeof sortedChatSessions,
    },
  );

  const chatMenuItems: NonNullable<MenuProps["items"]> = [
    ...(sessionGroups.today.length > 0
      ? [
          {
            type: "group" as const,
            label: "今天",
            children: sessionGroups.today.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
    ...(sessionGroups.lastSevenDays.length > 0
      ? [
          {
            type: "group" as const,
            label: "近 7 天",
            children: sessionGroups.lastSevenDays.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
    ...(sessionGroups.thisMonth.length > 0
      ? [
          {
            type: "group" as const,
            label: "本月",
            children: sessionGroups.thisMonth.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
    ...(sessionGroups.earlier.length > 0
      ? [
          {
            type: "group" as const,
            label: "更早",
            children: sessionGroups.earlier.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
  ];
  const bottomMenuItems: NonNullable<MenuProps["items"]> = [
    { key: ROUTE_PATHS.skills, icon: <AppstoreOutlined />, label: "技能中心" },
    {
      key: ROUTE_PATHS.tasks,
      icon: <OrderedListOutlined />,
      label: "计划任务",
    },
    { key: ROUTE_PATHS.memory, icon: <DatabaseOutlined />, label: "长期记忆" },
    { key: ROUTE_PATHS.settings, icon: <SettingOutlined />, label: "设置" },
  ];
  const selectedKey =
    location.pathname === ROUTE_PATHS.chat && activeChatSessionId
      ? `chat:${activeChatSessionId}`
      : String(
          bottomMenuItems.find(
            (item) => item && "key" in item && location.pathname === item.key,
          )?.key ?? ROUTE_PATHS.skills,
        );
  const chatSelectedKeys = selectedKey.startsWith("chat:") ? [selectedKey] : [];
  const bottomSelectedKeys = selectedKey.startsWith("chat:")
    ? []
    : [selectedKey];

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    const keyValue = String(key);

    if (keyValue.startsWith("chat:")) {
      activateSession(keyValue.slice(5));
      navigate(ROUTE_PATHS.chat);
      return;
    }

    navigate(keyValue);
  };

  return (
    <Sider className={styles.wrapper} width={240}>
      <Flex align="center" className={styles.actions} gap={8} justify="end">
        <Tooltip title="新开对话">
          <Button size="small" icon={<PlusOutlined />} onClick={createSession}>
            新开对话
          </Button>
        </Tooltip>
      </Flex>
      <Menu
        className={styles.chatMenuScroll}
        mode="inline"
        selectedKeys={chatSelectedKeys}
        items={chatMenuItems}
        onClick={handleMenuClick}
      />
      <Menu
        className={styles.bottomMenu}
        mode="inline"
        selectedKeys={bottomSelectedKeys}
        items={bottomMenuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

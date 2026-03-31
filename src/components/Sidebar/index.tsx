import {
  AppstoreOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlusOutlined,
  RocketOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Flex, Layout, Menu, MenuProps, Popconfirm, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import styles from "./index.css";
import { useChatStore, useLayoutStore } from "~/store";

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
        onConfirm={(event) => {
          event?.stopPropagation();
          onDelete(sessionId);
        }}
      >
        <Button
          className={styles.deleteButton}
          icon={<DeleteOutlined />}
          size="small"
          type="text"
        />
      </Popconfirm>
    </Flex>
  ),
});

export const Sidebar = () => {
  const activeChatSessionId = useChatStore((state) => state.activeChatSessionId);
  const chatSessions = useChatStore((state) => state.chatSessions);
  const activateSession = useChatStore((state) => state.activateSession);
  const createSession = useChatStore((state) => state.createSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const collapseSidebar = useLayoutStore((state) => state.collapseSidebar);
  const toggleCollapseSidebar = useLayoutStore((state) => state.toggleCollapseSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const sortedChatSessions = [...chatSessions].sort(
    (left, right) => dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf(),
  );

  const now = dayjs();
  const todayStart = now.startOf("day");
  const sevenDaysAgo = todayStart.subtract(7, "day");

  const sessionsToday = sortedChatSessions.filter((session) => {
    const updatedAt = dayjs(session.updatedAt);
    return updatedAt.isValid() && updatedAt.isSame(now, "day");
  });
  const sessionsLastSevenDays = sortedChatSessions.filter((session) => {
    const updatedAt = dayjs(session.updatedAt);

    if (!updatedAt.isValid()) {
      return false;
    }

    return (
      updatedAt.valueOf() >= sevenDaysAgo.valueOf() &&
      updatedAt.valueOf() < todayStart.valueOf() &&
      !updatedAt.isSame(now, "day")
    );
  });
  const sessionsThisMonth = sortedChatSessions.filter((session) => {
    const updatedAt = dayjs(session.updatedAt);

    if (!updatedAt.isValid()) {
      return false;
    }

    return updatedAt.isSame(now, "month") && updatedAt.valueOf() < sevenDaysAgo.valueOf();
  });
  const sessionsEarlier = sortedChatSessions.filter((session) => {
    const updatedAt = dayjs(session.updatedAt);

    if (!updatedAt.isValid()) {
      return true;
    }

    return !updatedAt.isSame(now, "month");
  });

  const chatMenuItems: NonNullable<MenuProps["items"]> = [
    ...(sessionsToday.length > 0
      ? [
          {
            type: "group" as const,
            label: "今天",
            children: sessionsToday.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
    ...(sessionsLastSevenDays.length > 0
      ? [
          {
            type: "group" as const,
            label: "近 7 天",
            children: sessionsLastSevenDays.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
    ...(sessionsThisMonth.length > 0
      ? [
          {
            type: "group" as const,
            label: "本月",
            children: sessionsThisMonth.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
    ...(sessionsEarlier.length > 0
      ? [
          {
            type: "group" as const,
            label: "更早",
            children: sessionsEarlier.map((session) =>
              buildChatMenuItem(session.id, session.title, deleteSession),
            ),
          },
        ]
      : []),
  ];
  const bottomMenuItems: NonNullable<MenuProps["items"]> = [
    { key: ROUTE_PATHS.workspace, icon: <RocketOutlined />, label: "工作台" },
    { key: ROUTE_PATHS.skills, icon: <AppstoreOutlined />, label: "技能中心" },
    { key: ROUTE_PATHS.installed, icon: <CloudDownloadOutlined />, label: "已安装" },
    { key: ROUTE_PATHS.settings, icon: <SettingOutlined />, label: "设置" },
  ];
  const selectedKey =
    location.pathname === ROUTE_PATHS.chat && activeChatSessionId
      ? `chat:${activeChatSessionId}`
      : String(
          bottomMenuItems.find((item) => item && "key" in item && location.pathname === item.key)
            ?.key ?? ROUTE_PATHS.skills,
        );
  const chatSelectedKeys = selectedKey.startsWith("chat:") ? [selectedKey] : [];
  const bottomSelectedKeys = selectedKey.startsWith("chat:") ? [] : [selectedKey];

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
    <Sider
      className={styles.wrapper}
      width={240}
      collapsible
      collapsed={collapseSidebar}
      trigger={null}
    >
      {collapseSidebar ? null : (
        <Flex align="center" className={styles.actions} gap={8} justify="end">
          <Tooltip title="收起侧边栏">
            <Button
              size="small"
              icon={<MenuUnfoldOutlined />}
              shape="circle"
              onClick={toggleCollapseSidebar}
            />
          </Tooltip>
          <Tooltip title="新对话">
            <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={createSession} />
          </Tooltip>
        </Flex>
      )}
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

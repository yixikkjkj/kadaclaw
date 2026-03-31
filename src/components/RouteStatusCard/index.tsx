import { Alert, Button, Card, Flex, Progress, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { ROUTE_PATHS } from "~/common/constants";
import styles from "./index.css";

const { Text, Title } = Typography;

interface RouteStatusCardProps {
  mode: "loading" | "error";
  title: string;
  message: string;
}

export function RouteStatusCard({ mode, title, message }: RouteStatusCardProps) {
  const [showDelayedHint, setShowDelayedHint] = useState(false);

  useEffect(() => {
    if (mode !== "loading") {
      setShowDelayedHint(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowDelayedHint(true);
    }, 8000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mode]);

  return (
    <Card className={[styles.bootstrapCard, styles.routeStatusCard].join(" ")}>
      <Flex vertical gap={16}>
        <Flex vertical gap={10}>
          {mode === "loading" ? <Spin /> : null}
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
          <Text type="secondary">{message}</Text>
        </Flex>

        {mode === "loading" ? (
          <Progress
            percent={showDelayedHint ? 92 : 68}
            showInfo={false}
            strokeColor="#0f7b6c"
            trailColor="#d9e6df"
          />
        ) : (
          <Alert
            type="error"
            showIcon
            message="页面模块未能正常加载"
            description="这通常是页面资源加载失败或初始化异常导致的，可以先刷新当前页面。"
          />
        )}

        {showDelayedHint ? (
          <Alert
            type="warning"
            showIcon
            message="当前页面加载时间过长"
            description="如果停留在这里超过几秒，通常不是正常现象，建议直接刷新。"
          />
        ) : null}

        <Flex gap={12} wrap>
          <Button type="primary" onClick={() => window.location.reload()}>
            刷新当前页面
          </Button>
          <Button
            onClick={() => {
              window.location.hash = `#${ROUTE_PATHS.skills}`;
            }}
          >
            返回技能中心
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}

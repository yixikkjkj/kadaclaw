import { Alert, Button, Card, Descriptions, Drawer, Flex, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useSkillInstall } from "~/store";
import { getMarketSkillDetail, type MarketSkillDetail } from "~/api";
import { useAppStore } from "~/store";

const { Link, Paragraph, Text } = Typography;

function formatDate(value?: number | null) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleString("zh-CN");
}

function formatCount(value?: number | null) {
  if (typeof value !== "number") {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function getErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim();
  }
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }
  return "无法读取技能详情";
}

export function SkillDetailDrawer() {
  const selectedSkillId = useAppStore((state) => state.selectedSkillId);
  const skillDrawerOpen = useAppStore((state) => state.skillDrawerOpen);
  const closeSkill = useAppStore((state) => state.closeSkill);
  const marketSkills = useAppStore((state) => state.marketSkills);
  const installedSkills = useAppStore((state) => state.installedSkills);
  const { installedSkillIds, skillOperations, skillOperationError, toggleSkillInstall } = useSkillInstall();
  const [detail, setDetail] = useState<MarketSkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketSummary = useMemo(
    () => marketSkills.find((item) => item.id === selectedSkillId) ?? null,
    [marketSkills, selectedSkillId],
  );
  const installedSummary = useMemo(
    () => installedSkills.find((item) => item.id === selectedSkillId) ?? null,
    [installedSkills, selectedSkillId],
  );

  useEffect(() => {
    if (!skillDrawerOpen || !selectedSkillId) {
      setDetail(null);
      setError(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        setDetail(null);
        const nextDetail = await getMarketSkillDetail(selectedSkillId);
        if (!active) {
          return;
        }
        setDetail(nextDetail);
      } catch (reason) {
        if (!active) {
          return;
        }
        setDetail(null);
        setError(getErrorMessage(reason));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedSkillId, skillDrawerOpen]);

  if (!selectedSkillId) {
    return null;
  }

  const installed = installedSkillIds.includes(selectedSkillId);
  const operation = skillOperations[selectedSkillId];
  const busy = Boolean(operation);
  const displayName =
    detail?.name ?? marketSummary?.name ?? installedSummary?.name ?? selectedSkillId;
  const displaySummary =
    detail?.summary ?? marketSummary?.summary ?? installedSummary?.summary ?? "暂无技能说明。";
  const displayVersion =
    detail?.version ?? marketSummary?.version ?? installedSummary?.version ?? "latest";
  const displayAuthor =
    detail?.author ?? installedSummary?.author ?? "ClawHub";
  const displayUpdatedAt = detail?.updatedAt ?? marketSummary?.updatedAt ?? null;
  const displayPlatforms = detail?.platformTargets ?? marketSummary?.platformTargets ?? [];
  const displaySystems = detail?.systemTargets ?? marketSummary?.systemTargets ?? [];
  const sourceUrl =
    detail?.sourceUrl ?? marketSummary?.sourceUrl ?? `https://clawhub.ai/skills/${selectedSkillId}`;

  return (
    <Drawer
      open={skillDrawerOpen}
      width={560}
      title={displayName}
      onClose={closeSkill}
      extra={
        <Button
          type={installed ? "default" : "primary"}
          loading={busy}
          disabled={busy}
          onClick={() =>
            void toggleSkillInstall({
              id: selectedSkillId,
              name: displayName,
              summary: displaySummary,
              author: displayAuthor,
              category: installedSummary?.category ?? "ClawHub",
              version: detail?.version ?? marketSummary?.version,
              sourceUrl,
            })
          }
        >
          {operation === "removing"
            ? "正在移除"
            : operation === "installing"
              ? "正在安装"
              : installed
                ? "移除技能"
                : "安装技能"}
        </Button>
      }
    >
      <Flex vertical gap={20}>
        {skillOperationError ? (
          <Alert type="error" showIcon message={skillOperationError} />
        ) : null}
        {error ? (
          <Alert
            type="info"
            showIcon
            message={`${error}，当前先展示本地已知信息。`}
          />
        ) : null}

        <Flex gap={8} wrap>
          <Tag color="green">v{displayVersion}</Tag>
          <Tag>{displayAuthor}</Tag>
          {installedSummary ? <Tag color="gold">{installedSummary.category}</Tag> : null}
          {displayPlatforms.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </Flex>

        <Paragraph>{displaySummary}</Paragraph>

        <Card title="概览">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="技能 ID">{selectedSkillId}</Descriptions.Item>
            <Descriptions.Item label="最近更新">{formatDate(displayUpdatedAt)}</Descriptions.Item>
            <Descriptions.Item label="来源">
              <Link href={sourceUrl} target="_blank">
                {sourceUrl}
              </Link>
            </Descriptions.Item>
            {installedSummary ? (
              <Descriptions.Item label="本地目录">{installedSummary.directory}</Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        <Card title="市场指标">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="安装量">{formatCount(detail?.installs)}</Descriptions.Item>
            <Descriptions.Item label="下载量">{formatCount(detail?.downloads)}</Descriptions.Item>
            <Descriptions.Item label="收藏数">{formatCount(detail?.stars)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="兼容目标">
          {displayPlatforms.length === 0 && displaySystems.length === 0 ? (
            <Text type="secondary">ClawHub 暂未返回平台限制信息。</Text>
          ) : (
            <Flex gap={8} wrap>
              {displayPlatforms.map((item) => (
                <Tag key={`os-${item}`} color="blue">
                  {item}
                </Tag>
              ))}
              {displaySystems.map((item) => (
                <Tag key={`system-${item}`}>{item}</Tag>
              ))}
            </Flex>
          )}
        </Card>

        <Card title="更新说明">
          <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
            {loading
              ? "正在加载最新市场详情..."
              : detail?.changelog || "官方市场当前没有提供 changelog。"}
          </Paragraph>
        </Card>
      </Flex>
    </Drawer>
  );
}

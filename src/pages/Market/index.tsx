import { Alert, Badge, Button, Card, Col, Empty, Flex, Input, Progress, Row, Segmented, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { listMarketSkills, type MarketSkillSort } from "~/api";
import { useSkillInstall } from "~/store";
import { useAppStore } from "~/store";
import * as styles from "~/common/ui.css";

const { Paragraph, Text, Title } = Typography;

const sortOptions: { label: string; value: MarketSkillSort }[] = [
  { label: "最新更新", value: "updated" },
  { label: "下载最多", value: "downloads" },
  { label: "最多收藏", value: "stars" },
  { label: "近期热门", value: "trending" },
];

function formatCount(value?: number | null) {
  if (typeof value !== "number") {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value?: number | null) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleDateString("zh-CN");
}

function getErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim();
  }
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }
  return "技能市场暂时不可用";
}

export function MarketPage() {
  const search = useAppStore((state) => state.search);
  const marketSort = useAppStore((state) => state.marketSort);
  const marketSkills = useAppStore((state) => state.marketSkills);
  const setSearch = useAppStore((state) => state.setSearch);
  const setMarketSort = useAppStore((state) => state.setMarketSort);
  const setMarketSkills = useAppStore((state) => state.setMarketSkills);
  const openSkill = useAppStore((state) => state.openSkill);
  const {
    installedSkillIds,
    recognizedSkillIds,
    readySkillIds,
    skillOperations,
    skillOperationError,
    toggleSkillInstall,
  } =
    useSkillInstall();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          setError(null);
          const items = await listMarketSkills(search.trim() || undefined, 24, marketSort);
          if (!active) {
            return;
          }
          setMarketSkills(items);
        } catch (reason) {
          if (!active) {
            return;
          }
          setMarketSkills([]);
          setError(getErrorMessage(reason));
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
    }, search.trim() ? 320 : 0);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [marketSort, search, setMarketSkills]);

  return (
    <Flex vertical gap={20}>
      <Card className={styles.marketToolbar}>
        <div className={styles.marketHero}>
          <div className={styles.marketCopy}>
            <Title level={2} style={{ margin: 0 }}>
              技能市场
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              当前列表实时读取 ClawHub 官方技能市场，不再使用本地写死的演示 skills 数据。
            </Paragraph>
          </div>
          <div className={styles.marketStats}>
            <div className={styles.marketStatChip}>市场源 1</div>
            <div className={styles.marketStatChip}>当前结果 {marketSkills.length}</div>
            <div className={styles.marketStatChip}>已安装 {installedSkillIds.length}</div>
          </div>
        </div>
        <div className={styles.marketFeatureBand}>
          <div>
            <Text type="secondary">官方源</Text>
            <div className={styles.featureBandTitle}>ClawHub / 实时拉取 / 非可疑技能过滤</div>
          </div>
          <Progress
            percent={loading ? 68 : 100}
            showInfo={false}
            strokeColor={{
              "0%": "#0f7b6c",
              "100%": "#d98a32",
            }}
            trailColor="rgba(28, 35, 31, 0.08)"
          />
        </div>
        <Row gutter={[12, 12]} style={{ marginTop: 18 }}>
          <Col xs={24} lg={14}>
            <Input.Search
              placeholder="搜索 ClawHub 技能"
              size="large"
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Col>
          <Col xs={24} lg={10}>
            <Segmented
              block
              options={sortOptions}
              value={marketSort}
              onChange={(value) => setMarketSort(value as MarketSkillSort)}
            />
          </Col>
        </Row>
      </Card>

      {error ? <Alert type="warning" showIcon message={error} /> : null}
      {skillOperationError ? (
        <Alert
          type="error"
          showIcon
          message={skillOperationError}
          description="安装失败时通常是网络限流、技能包缺失，或本地 runtime 目录不可写。"
        />
      ) : null}

      {loading ? (
        <Card className={styles.panelCard}>
          <Flex justify="center" align="center" style={{ minHeight: 220 }}>
            <Spin tip="正在从 ClawHub 拉取技能..." />
          </Flex>
        </Card>
      ) : null}

      {!loading && marketSkills.length === 0 ? (
        <Card className={styles.panelCard}>
          <Empty
            description={search.trim() ? "没有找到匹配的官方技能" : "官方技能市场当前没有可显示结果"}
          />
        </Card>
      ) : null}

      {!loading ? (
        <Row gutter={[16, 16]}>
          {marketSkills.map((skill) => {
            const installed = installedSkillIds.includes(skill.id);
            const recognized = recognizedSkillIds.includes(skill.id);
            const ready = readySkillIds.includes(skill.id);
            const operation = skillOperations[skill.id];
            const busy = Boolean(operation);

            return (
              <Col xs={24} md={12} xl={8} key={skill.id}>
                <Card className={[styles.skillCard, styles.elevatedCard].join(" ")}>
                  <Flex align="center" justify="space-between" gap={12}>
                    <Flex align="center" gap={12}>
                      <div className={styles.skillAvatarShell}>{skill.name.slice(0, 1)}</div>
                      <div>
                        <Text strong>{skill.name}</Text>
                        <div>
                          <Text type="secondary">{skill.id}</Text>
                        </div>
                      </div>
                    </Flex>
                    <Badge status={installed ? "success" : "processing"} text={installed ? "已安装" : "可安装"} />
                  </Flex>

                  <Paragraph className={styles.skillSummary}>{skill.summary}</Paragraph>

                  <Flex gap={8} wrap style={{ marginBottom: 16 }}>
                    <Tag color="green">v{skill.version}</Tag>
                    {recognized ? (
                      <Tag color={ready ? "blue" : "orange"}>
                        {ready ? "OpenClaw 已就绪" : "OpenClaw 已识别"}
                      </Tag>
                    ) : null}
                    {skill.platformTargets.slice(0, 2).map((target) => (
                      <Tag key={target}>{target}</Tag>
                    ))}
                  </Flex>

                  <div className={styles.skillMetricStrip}>
                    <div>
                      <Text type="secondary">最近更新</Text>
                      <strong>{formatDate(skill.updatedAt)}</strong>
                    </div>
                    <div>
                      <Text type="secondary">安装量</Text>
                      <strong>{formatCount(skill.installs)}</strong>
                    </div>
                    <div>
                      <Text type="secondary">收藏</Text>
                      <strong>{formatCount(skill.stars)}</strong>
                    </div>
                  </div>

                  <Flex vertical gap={10} style={{ marginTop: 16 }}>
                    <Button block onClick={() => openSkill(skill.id)}>
                      查看详情
                    </Button>
                    <Button
                      type={installed ? "default" : "primary"}
                      block
                      loading={busy}
                      disabled={busy}
                      onClick={() =>
                        void toggleSkillInstall({
                          id: skill.id,
                          name: skill.name,
                          summary: skill.summary,
                          version: skill.version,
                          sourceUrl: skill.sourceUrl,
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
                  </Flex>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : null}
    </Flex>
  );
}

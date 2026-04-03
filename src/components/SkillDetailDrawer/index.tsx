import { Alert, Button, Card, Descriptions, Drawer, Flex, Tag, Typography } from "antd";
import { useMemo } from "react";
import { getSkillBlueprint } from "~/common/ecommerce";
import { useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text } = Typography;

export function SkillDetailDrawer() {
  const selectedSkillId = useSkillStore((state) => state.selectedSkillId);
  const skillDrawerOpen = useSkillStore((state) => state.skillDrawerOpen);
  const closeSkill = useSkillStore((state) => state.closeSkill);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const skillOperations = useSkillStore((state) => state.skillOperations);
  const skillOperationError = useSkillStore((state) => state.skillOperationError);
  const removeInstalledSkill = useSkillStore((state) => state.removeInstalledSkill);

  const installedSummary = useMemo(
    () => installedSkills.find((item) => item.id === selectedSkillId) ?? null,
    [installedSkills, selectedSkillId],
  );
  const blueprint = useMemo(
    () =>
      getSkillBlueprint({
        id: selectedSkillId ?? undefined,
        name: installedSummary?.name,
        category: installedSummary?.category,
      }),
    [installedSummary?.category, installedSummary?.name, selectedSkillId],
  );

  if (!selectedSkillId) {
    return null;
  }

  const installed = installedSkillIds.includes(selectedSkillId);
  const operation = skillOperations[selectedSkillId];
  const busy = Boolean(operation);
  const displayName = installedSummary?.name ?? blueprint?.title ?? selectedSkillId;
  const displaySummary =
    blueprint?.summary ?? installedSummary?.summary ?? "暂无能力说明，后续会补充更详细的业务说明。";

  return (
    <Drawer
      open={skillDrawerOpen}
      width={560}
      title={displayName}
      onClose={closeSkill}
      extra={
        installed ? (
          <Button
            type="primary"
            loading={busy}
            disabled={busy}
            onClick={() =>
              void removeInstalledSkill(selectedSkillId, displayName).then((removed) => {
                if (removed) {
                  closeSkill();
                }
              })
            }
          >
            {operation === "removing" ? "正在移除" : "移除能力"}
          </Button>
        ) : null
      }
    >
      <Flex vertical gap={20}>
        {skillOperationError ? <Alert type="error" showIcon message={skillOperationError} /> : null}
        {!installed ? (
          <Alert
            type="info"
            showIcon
            message="当前能力尚未启用"
            description="你可以先查看适用平台、输入要求和示例提问，再决定是否接入对应能力。"
          />
        ) : null}

        <Flex gap={8} wrap>
          <Tag color="green">v{installedSummary?.version ?? "preview"}</Tag>
          <Tag>{installedSummary?.author ?? "预置能力"}</Tag>
          <Tag color="gold">{blueprint?.category ?? installedSummary?.category ?? "经营能力"}</Tag>
          {installed ? <Tag color="blue">已启用</Tag> : <Tag>待启用</Tag>}
        </Flex>

        <Paragraph>{displaySummary}</Paragraph>

        {blueprint ? (
          <Card title="业务说明">
            <Flex vertical gap={16}>
              <div>
                <Text strong>适用平台</Text>
                <div className={styles.tagGroup}>
                  {blueprint.platforms.map((platform) => (
                    <Tag key={platform}>{platform}</Tag>
                  ))}
                </div>
              </div>
              <div>
                <Text strong>适用场景</Text>
                <div className={styles.tagGroup}>
                  {blueprint.scenes.map((scene) => (
                    <Tag key={scene} color="gold">
                      {scene}
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <Text strong>建议准备的上下文</Text>
                <div className={styles.tagGroup}>
                  {blueprint.requiredContexts.map((item) => (
                    <Tag key={item} color="blue">
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <Text strong>推荐提问</Text>
                <Flex vertical gap={8} className={styles.promptList}>
                  {blueprint.examplePrompts.map((item) => (
                    <Paragraph key={item} className={styles.promptItem}>
                      {item}
                    </Paragraph>
                  ))}
                </Flex>
              </div>
            </Flex>
          </Card>
        ) : null}

        <Card title="技术概览">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="技能 ID">{selectedSkillId}</Descriptions.Item>
            <Descriptions.Item label="版本">{installedSummary?.version ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="作者">{installedSummary?.author ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="分类">
              {blueprint?.category ?? installedSummary?.category ?? "--"}
            </Descriptions.Item>
            {installedSummary ? (
              <Descriptions.Item label="Manifest">
                {installedSummary.manifestPath}
              </Descriptions.Item>
            ) : null}
            {installedSummary ? (
              <Descriptions.Item label="本地目录">{installedSummary.directory}</Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        <Card title="状态说明">
          <Text type="secondary">
            当前版本优先使用本地和私有经营能力。后续会在这一块补平台接入状态、最近调用次数和上下文要求。
          </Text>
        </Card>
      </Flex>
    </Drawer>
  );
}

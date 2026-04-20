import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
  type FormInstance,
} from "antd";
import { OPENCLAW_PROVIDER_OPTIONS } from "~/common/constants";
import {
  type OpenClawAuthConfig,
  type OpenClawConfig,
  type OpenClawSelfCheckItem,
  type OpenClawSelfCheckResult,
  type OpenClawStatus,
  type RuntimeInfoResult,
} from "~/api";
import {
  formatCheckTime,
  getSelfCheckBadge,
  type OpenClawAuthFormValues,
  type OpenClawFormValues,
} from "./helpers";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

interface SettingsHeroSectionProps {
  authReady: boolean;
  loading: boolean;
  runtimeInstalled: boolean;
  runtimeReady: boolean;
  onInstallBundledRuntime: () => void;
  onLaunchRuntime: () => void;
  onRunProbe: () => void;
  onUpgradeBundledRuntime: () => void;
}

interface ReadinessSectionProps {
  authConfig: OpenClawAuthConfig | null;
  authReady: boolean;
  runtimeInstalled: boolean;
  runtimeReady: boolean;
}

interface LocalSkillsSectionProps {
  loading: boolean;
  localSkillsDirsInput: string;
  runtimeInfo: RuntimeInfoResult | null;
  windowsHost: boolean;
  onAppendLocalSkillsDirectory: () => void;
  onInputChange: (value: string) => void;
  onRestoreCurrentConfig: () => void;
  onSaveLocalSkillsDirectories: () => void;
}

interface ModelAuthSectionProps {
  authConfig: OpenClawAuthConfig | null;
  authForm: FormInstance<OpenClawAuthFormValues>;
  loading: boolean;
  onSaveAuth: () => void;
}

interface AdvancedPanelsSectionProps {
  dashboardUrl: string;
  form: FormInstance<OpenClawFormValues>;
  loading: boolean;
  runtimeInfo: RuntimeInfoResult | null;
  runtimeStatus: OpenClawStatus | null;
  selfCheckResult: OpenClawSelfCheckResult | null;
  selfChecks: OpenClawSelfCheckItem[];
  onCopyDashboardUrl: () => void;
  onOpenDashboard: () => void;
  onRefreshDashboardUrl: () => void;
  onRunProbe: () => void;
  onSaveConfig: () => void;
}

export const SettingsHeroSection = ({
  authReady,
  loading,
  runtimeInstalled,
  runtimeReady,
  onInstallBundledRuntime,
  onLaunchRuntime,
  onRunProbe,
  onUpgradeBundledRuntime,
}: SettingsHeroSectionProps) => (
  <Card className={styles.settingsHero}>
    <div className={styles.settingsHeroGrid}>
      <div>
        <Tag color="green" className={styles.heroTag}>
          Runtime Hub
        </Tag>
        <Title level={1} className={styles.workspaceTitle}>
          运行环境与模型设置
        </Title>
        <Paragraph className={styles.heroCopy}>
          日常只需要确认运行环境可用、模型授权已配置，就可以直接开始使用。更底层的参数和诊断信息已经收口到高级区域里。
        </Paragraph>
        <Flex gap={8} wrap style={{ marginBottom: 8 }}>
          <Button type="primary" loading={loading} onClick={onInstallBundledRuntime}>
            安装或修复运行环境
          </Button>
          <Button loading={loading} onClick={onLaunchRuntime}>
            启动运行环境
          </Button>
          <Button loading={loading} onClick={onRunProbe}>
            重新检查
          </Button>
          <Button loading={loading} onClick={onUpgradeBundledRuntime}>
            升级内置 OpenClaw
          </Button>
        </Flex>
      </div>
      <div>
        <Card>
          <div className={styles.runtimePanelContent}>
            <Text type="secondary">Runtime 摘要</Text>
            <Title level={3}>当前环境</Title>
            <div className={styles.runtimeMetaGrid}>
              <div>
                <Text type="secondary">运行环境</Text>
                <strong>{runtimeReady ? "已就绪" : runtimeInstalled ? "待启动" : "未安装"}</strong>
              </div>
              <div>
                <Text type="secondary">模型授权</Text>
                <strong>{authReady ? "已配置" : "未配置"}</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Card>
);

export const ReadinessSection = ({
  authConfig,
  authReady,
  runtimeInstalled,
  runtimeReady,
}: ReadinessSectionProps) => (
  <Card title="当前准备状态">
    <div className={styles.readinessGrid}>
      <div className={styles.readinessCard}>
        <Text type="secondary">运行环境</Text>
        <strong>
          {runtimeReady ? "已就绪" : runtimeInstalled ? "已安装，等待启动" : "尚未安装"}
        </strong>
        <Text type="secondary">
          {runtimeReady
            ? "Kadaclaw 已经可以连接到本地运行环境。"
            : runtimeInstalled
              ? "运行环境已经安装完成，但当前还没有成功连接。"
              : "建议先安装内置运行环境，避免额外配置。"}
        </Text>
      </div>
      <div className={styles.readinessCard}>
        <Text type="secondary">模型授权</Text>
        <strong>{authReady ? "已配置" : "尚未配置"}</strong>
        <Text type="secondary">
          {authReady
            ? `当前会按 ${authConfig?.model ?? "--"} 发起请求。`
            : "还需要选择模型提供方并填写 API Key，完成后才能正式开始聊天。"}
        </Text>
      </div>
    </div>
  </Card>
);

export const LocalSkillsSection = ({
  loading,
  localSkillsDirsInput,
  runtimeInfo,
  windowsHost,
  onAppendLocalSkillsDirectory,
  onInputChange,
  onRestoreCurrentConfig,
  onSaveLocalSkillsDirectories,
}: LocalSkillsSectionProps) => (
  <Card title="本地 Skills 目录">
    <Flex vertical gap={16}>
      <Paragraph type="secondary">
        这里可以接入你自己机器上的 Skills 目录。每行填写一个目录路径，保存后 Kadaclaw
        会自动创建缺失目录，并把它们写入 OpenClaw 的 `skills.load.extraDirs`，让 runtime
        识别这些本地技能。
      </Paragraph>
      <TextArea
        rows={5}
        value={localSkillsDirsInput}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder={
          windowsHost
            ? "例如：\nC:\\Users\\你的用户名\\openclaw-skills\nD:\\workspace\\my-skills"
            : "例如：\n/Users/your-name/openclaw-skills\n/Users/your-name/workspace/my-skills"
        }
      />
      <Flex gap={8} wrap>
        <Button loading={loading} onClick={onAppendLocalSkillsDirectory}>
          选择目录并追加
        </Button>
        <Button type="primary" loading={loading} onClick={onSaveLocalSkillsDirectories}>
          保存本地目录
        </Button>
        <Button loading={loading} onClick={() => onRestoreCurrentConfig()}>
          恢复当前配置
        </Button>
      </Flex>
      {runtimeInfo ? (
        <Text type="secondary">
          当前 runtime 已加载 {runtimeInfo.localSkillsDirs.length} 个本地目录。
        </Text>
      ) : null}
    </Flex>
  </Card>
);

export const ModelAuthSection = ({
  authConfig,
  authForm,
  loading,
  onSaveAuth,
}: ModelAuthSectionProps) => (
  <Card title="模型与授权">
    <Flex vertical gap={16}>
      <Alert
        type={authConfig?.apiKeyConfigured ? "success" : "warning"}
        showIcon
        message={
          authConfig?.apiKeyConfigured ? "当前 Provider 已配置授权" : "当前 Provider 尚未配置授权"
        }
        description={
          authConfig
            ? authConfig.provider === "custom"
              ? `当前模型为 ${authConfig.model}，OpenClaw 会读取 ${authConfig.apiKeyEnvName}，并通过 ${authConfig.apiBaseUrl || "未配置地址"} 发起请求。`
              : `当前模型为 ${authConfig.model}，OpenClaw 会读取 ${authConfig.apiKeyEnvName}。`
            : "为 OpenClaw 选择模型提供方并写入对应 API key。"
        }
      />

      <Form form={authForm} layout="vertical">
        <Row gutter={[16, 0]}>
          <Col xs={24} md={8}>
            <Form.Item label="Provider" name="provider" rules={[{ required: true }]}>
              <Select
                options={OPENCLAW_PROVIDER_OPTIONS.map((item) => ({
                  label: item.label,
                  value: item.value,
                }))}
                onChange={(value) => {
                  const next = OPENCLAW_PROVIDER_OPTIONS.find((item) => item.value === value);
                  if (!next) {
                    return;
                  }

                  authForm.setFieldsValue({
                    model: next.model,
                    apiBaseUrl: value === "custom" ? (authConfig?.apiBaseUrl ?? "") : "",
                  });
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item label="模型" name="model" rules={[{ required: true }]}>
              <Input placeholder="anthropic/claude-opus-4-6" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, nextValues) => prevValues.provider !== nextValues.provider}
            >
              {({ getFieldValue }) =>
                getFieldValue("provider") === "custom" ? (
                  <Form.Item
                    label="API Base URL"
                    name="apiBaseUrl"
                    rules={[{ required: true, message: "请输入 Custom Provider 的 API Base URL" }]}
                  >
                    <Input placeholder="https://bobdong.cn/v1" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="API Key" name="apiKey">
              <Input.Password placeholder="输入新的 API key，留空则保留当前已保存的 key" />
            </Form.Item>
          </Col>
        </Row>
        <Flex gap={8} wrap>
          <Button type="primary" loading={loading} onClick={onSaveAuth}>
            保存模型与授权
          </Button>
        </Flex>
      </Form>

      <Descriptions column={1} size="small">
        <Descriptions.Item label="当前 Provider">{authConfig?.provider ?? "--"}</Descriptions.Item>
        <Descriptions.Item label="当前模型">{authConfig?.model ?? "--"}</Descriptions.Item>
        <Descriptions.Item label="读取环境变量">
          {authConfig?.apiKeyEnvName ?? "--"}
        </Descriptions.Item>
        <Descriptions.Item label="授权状态">
          {authConfig?.apiKeyConfigured ? "已配置" : "未配置"}
        </Descriptions.Item>
      </Descriptions>
    </Flex>
  </Card>
);

export const AdvancedPanelsSection = ({
  dashboardUrl,
  form,
  loading,
  runtimeInfo,
  runtimeStatus,
  selfCheckResult,
  selfChecks,
  onCopyDashboardUrl,
  onOpenDashboard,
  onRefreshDashboardUrl,
  onRunProbe,
  onSaveConfig,
}: AdvancedPanelsSectionProps) => (
  <Collapse
    className={styles.advancedPanels}
    items={[
      {
        key: "advanced-config",
        label: "高级运行配置",
        children: (
          <Flex vertical gap={20}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              只有在你需要覆盖默认端口、启动命令、工作目录或手动排查运行环境时，才需要修改这里的内容。
            </Paragraph>

            <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item label="启用 Runtime" name="enabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="显示名称" name="displayName" rules={[{ required: true }]}>
                    <Input placeholder="OpenClaw Runtime" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Base URL" name="baseUrl" rules={[{ required: true }]}>
                    <Input placeholder="http://127.0.0.1:18795" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="健康检查路径" name="healthPath" rules={[{ required: true }]}>
                    <Input placeholder="/v1/models" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="模型" name="model" rules={[{ required: true }]}>
                    <Input placeholder="anthropic/claude-opus-4-6" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="启动命令" name="command" rules={[{ required: true }]}>
                    <Input placeholder="openclaw" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="启动参数" name="args">
                    <Input placeholder="gateway run --allow-unconfigured --port 18795 --force" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="工作目录" name="workingDirectory">
                    <Input placeholder="/path/to/openclaw" />
                  </Form.Item>
                </Col>
              </Row>
              <Flex gap={8} wrap>
                <Button type="primary" loading={loading} onClick={onSaveConfig}>
                  保存并检测
                </Button>
                <Button loading={loading} onClick={onRunProbe}>
                  只检测
                </Button>
              </Flex>
            </Form>

            <Card title="Control UI" size="small">
              <Flex vertical gap={16}>
                <Alert
                  type="info"
                  showIcon
                  message="遇到 gateway token missing 时这样处理"
                  description="先打开 Dashboard URL，再把页面里提供的 gateway token 粘贴到 Control UI settings。模型 API Key 不能填在这里。"
                />

                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  Control UI 的授权依赖 gateway token，不是模型 API key。如果你看到 `unauthorized:
                  gateway token missing`，通常说明还没有从 Dashboard URL 获取 token。
                </Paragraph>

                <Input
                  readOnly
                  value={dashboardUrl}
                  placeholder="先点击“获取 Dashboard URL”或“打开 Control UI”"
                />

                <Flex gap={8} wrap>
                  <Button type="primary" loading={loading} onClick={onOpenDashboard}>
                    打开 Control UI
                  </Button>
                  <Button loading={loading} onClick={onRefreshDashboardUrl}>
                    获取 Dashboard URL
                  </Button>
                  <Button disabled={!dashboardUrl} onClick={onCopyDashboardUrl}>
                    复制 Dashboard URL
                  </Button>
                </Flex>

                <div className={styles.controlUiSteps}>
                  <Text>1. 点击“打开 Control UI”或复制 Dashboard URL 到浏览器打开。</Text>
                  <Text>2. 从页面拿到 gateway token。</Text>
                  <Text>3. 把 token 粘贴到 Control UI 的 Settings。</Text>
                </div>
              </Flex>
            </Card>
          </Flex>
        ),
      },
      {
        key: "diagnostics",
        label: "诊断信息",
        children: (
          <Flex vertical gap={20}>
            <Card
              title="安装后自检"
              size="small"
              extra={
                <Flex align="center" gap={12}>
                  <Text type="secondary">
                    上次检查：{formatCheckTime(selfCheckResult?.checkedAt)}
                  </Text>
                  <Button size="small" loading={loading} onClick={onRunProbe}>
                    重新执行自检
                  </Button>
                </Flex>
              }
            >
              <Descriptions column={1} size="small">
                {selfChecks.map((item) => (
                  <Descriptions.Item key={item.key} label={item.label}>
                    <Flex vertical gap={4}>
                      {getSelfCheckBadge(item.status)}
                      <Text type="secondary">{item.detail}</Text>
                      {item.suggestion ? <Text>{item.suggestion}</Text> : null}
                    </Flex>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>

            <Row gutter={[16, 16]}>
              {runtimeStatus ? (
                <Col xs={24} xl={12}>
                  <Card title="OpenClaw 检测结果" size="small">
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Endpoint">
                        {runtimeStatus.endpoint}
                      </Descriptions.Item>
                      <Descriptions.Item label="消息">{runtimeStatus.message}</Descriptions.Item>
                      <Descriptions.Item label="内置 Runtime">
                        {runtimeStatus.bundled ? "是" : "否"}
                      </Descriptions.Item>
                      <Descriptions.Item label="HTTP 可达">
                        {runtimeStatus.reachable ? "是" : "否"}
                      </Descriptions.Item>
                      <Descriptions.Item label="HTTP 状态码">
                        {runtimeStatus.httpStatus ?? "--"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              ) : null}

              {runtimeInfo ? (
                <Col xs={24} xl={12}>
                  <Card title="OpenClaw Runtime 信息" size="small">
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="版本">{runtimeInfo.version}</Descriptions.Item>
                      <Descriptions.Item label="版本读取错误">
                        {runtimeInfo.versionError ?? "--"}
                      </Descriptions.Item>
                      <Descriptions.Item label="命令路径">
                        {runtimeInfo.commandPath}
                      </Descriptions.Item>
                      <Descriptions.Item label="安装目录">
                        {runtimeInfo.installDir}
                      </Descriptions.Item>
                      <Descriptions.Item label="技能目录">
                        {runtimeInfo.skillsDir}
                      </Descriptions.Item>
                      <Descriptions.Item label="本地 Skills 目录">
                        {runtimeInfo.localSkillsDirs.length > 0
                          ? runtimeInfo.localSkillsDirs.join(" ; ")
                          : "--"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              ) : null}
            </Row>
          </Flex>
        ),
      },
    ]}
  />
);

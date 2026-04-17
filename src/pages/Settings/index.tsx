import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Flex,
  Form,
  Input,
  message,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { OPENCLAW_PROVIDER_OPTIONS } from "~/common/constants";
import {
  getOpenClawAuthConfig,
  getOpenClawConfig,
  getOpenClawDashboardUrl,
  getOpenClawLocalSkillsDirs,
  installBundledOpenClawRuntime,
  launchOpenClawRuntime,
  openOpenClawDashboard,
  pickOpenClawLocalSkillsDir,
  type OpenClawAuthConfig,
  type OpenClawConfig,
  type OpenClawSelfCheckResult,
  type OpenClawStatus,
  runOpenClawSelfCheck,
  type RuntimeInfoResult,
  saveOpenClawAuthConfig,
  saveOpenClawConfig,
  saveOpenClawLocalSkillsDirs,
  upgradeBundledOpenClawRuntime,
} from "~/api";
import { useRuntimeStore, useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

export interface OpenClawFormValues extends Omit<OpenClawConfig, "args"> {
  args: string;
}

interface OpenClawAuthFormValues {
  provider: string;
  model: string;
  apiKey: string;
  apiBaseUrl: string;
}

function isWindowsHost() {
  return typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);
}

type SelfCheckState = "pass" | "warn" | "fail";

function getSelfCheckBadge(state: SelfCheckState) {
  switch (state) {
    case "pass":
      return <Badge status="success" text="通过" />;
    case "warn":
      return <Badge status="processing" text="待确认" />;
    case "fail":
    default:
      return <Badge status="error" text="失败" />;
  }
}

function formatCheckTime(value?: number | null) {
  if (!value) {
    return "尚未执行";
  }
  return dayjs(value).format("YYYY/M/D HH:mm:ss");
}

const parseLocalSkillsDirsInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export function SettingsPage() {
  const [form] = Form.useForm<OpenClawFormValues>();
  const [authForm] = Form.useForm<OpenClawAuthFormValues>();
  const [runtimeStatus, setRuntimeStatus] = useState<OpenClawStatus | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfoResult | null>(null);
  const [selfCheckResult, setSelfCheckResult] = useState<OpenClawSelfCheckResult | null>(null);
  const [authConfig, setAuthConfig] = useState<OpenClawAuthConfig | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [localSkillsDirsInput, setLocalSkillsDirsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const setRuntimeState = useRuntimeStore((state) => state.setRuntimeState);
  const refreshInstalledSkills = useSkillStore((state) => state.refreshInstalledSkills);
  const windowsHost = isWindowsHost();
  const runtimeReady = runtimeStatus?.reachable ?? false;
  const runtimeInstalled = runtimeInfo?.installed ?? false;
  const authReady = authConfig?.apiKeyConfigured ?? false;

  const refreshRuntimeInfo = async () => {
    try {
      const result = await runOpenClawSelfCheck();
      setSelfCheckResult(result);
      setRuntimeInfo(result.runtimeInfo);
      setRuntimeStatus(result.runtimeStatus);
    } catch (error) {
      message.error(`读取 Runtime 信息失败: ${String(error)}`);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const config = await getOpenClawConfig();
        form.setFieldsValue({
          ...config,
          args: config.args.join(" "),
        });
      } catch (error) {
        message.error(`读取 OpenClaw 配置失败: ${String(error)}`);
      }
      await refreshRuntimeInfo();
      try {
        const localSkillsDirs = await getOpenClawLocalSkillsDirs();
        setLocalSkillsDirsInput(localSkillsDirs.directories.join("\n"));
      } catch (error) {
        message.error(`读取本地 Skills 目录失败: ${String(error)}`);
      }
      try {
        const auth = await getOpenClawAuthConfig();
        setAuthConfig(auth);
        authForm.setFieldsValue({
          provider: auth.provider,
          model: auth.model,
          apiKey: "",
          apiBaseUrl: auth.apiBaseUrl ?? "",
        });
      } catch (error) {
        message.error(`读取授权配置失败: ${String(error)}`);
      }
    })();
  }, [authForm, form]);

  const performSelfCheck = async (options?: { showSuccessMessage?: boolean }) => {
    const showSuccessMessage = options?.showSuccessMessage ?? true;
    try {
      setRuntimeState("checking", "正在检测 OpenClaw runtime");
      const result = await runOpenClawSelfCheck();
      setSelfCheckResult(result);
      setRuntimeInfo(result.runtimeInfo);
      setRuntimeStatus(result.runtimeStatus);
      setRuntimeState(
        result.runtimeStatus.reachable ? "ready" : "error",
        result.runtimeStatus.message,
      );
      if (showSuccessMessage) {
        message.success("OpenClaw 自检已完成");
      }
    } catch (error) {
      const text = `检测失败: ${String(error)}`;
      setRuntimeState("error", text);
      if (showSuccessMessage) {
        message.error(text);
      }
    }
  };

  const runProbe = async () => {
    setLoading(true);
    try {
      await performSelfCheck();
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const normalized: OpenClawConfig = {
        ...values,
        args: values.args
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const saved = await saveOpenClawConfig(normalized);
      form.setFieldsValue({
        ...saved,
        args: saved.args.join(" "),
      });
      message.success("OpenClaw 配置已保存");
      await performSelfCheck();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const installBundledRuntime = async () => {
    setLoading(true);
    setRuntimeState("checking", "正在安装内置 OpenClaw runtime");
    try {
      const result = await installBundledOpenClawRuntime();
      form.setFieldsValue({
        ...result.config,
        args: result.config.args.join(" "),
      });
      setRuntimeStatus(result.status);
      setRuntimeState("checking", result.status.message);
      await performSelfCheck({ showSuccessMessage: false });
      message.success("内置 OpenClaw 已安装到应用目录");
    } catch (error) {
      const text = `安装失败: ${String(error)}`;
      setRuntimeState("error", text);
      message.error(text);
    } finally {
      setLoading(false);
    }
  };

  const upgradeBundledRuntime = async () => {
    setLoading(true);
    setRuntimeState("checking", "正在升级内置 OpenClaw runtime");
    try {
      const result = await upgradeBundledOpenClawRuntime();
      form.setFieldsValue({
        ...result.config,
        args: result.config.args.join(" "),
      });
      setRuntimeStatus(result.status);
      await performSelfCheck({ showSuccessMessage: false });
      message.success("内置 OpenClaw 已升级并完成自检");
    } catch (error) {
      const text = `升级失败: ${String(error)}`;
      setRuntimeState("error", text);
      message.error(text);
    } finally {
      setLoading(false);
    }
  };

  const launchRuntime = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const payload: OpenClawConfig = {
        ...values,
        args: values.args
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean),
      };
      await saveOpenClawConfig(payload);
      const status = await launchOpenClawRuntime();
      setRuntimeStatus(status);
      setRuntimeState("checking", status.message);
      await performSelfCheck({ showSuccessMessage: false });
      message.success("已启动 OpenClaw runtime 并完成自检");
    } catch (error) {
      message.error(`启动失败: ${String(error)}`);
      setRuntimeState("error", `启动失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const saveLocalSkillsDirectories = async () => {
    setLoading(true);
    try {
      const directories = parseLocalSkillsDirsInput(localSkillsDirsInput);
      const saved = await saveOpenClawLocalSkillsDirs(directories);
      setLocalSkillsDirsInput(saved.directories.join("\n"));
      await performSelfCheck({ showSuccessMessage: false });
      await refreshInstalledSkills();
      message.success("本地 Skills 目录已更新");
    } catch (error) {
      message.error(`保存本地 Skills 目录失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const appendLocalSkillsDirectory = async () => {
    setLoading(true);
    try {
      const directory = await pickOpenClawLocalSkillsDir();
      if (!directory) {
        return;
      }

      const nextDirectories = Array.from(
        new Set([...parseLocalSkillsDirsInput(localSkillsDirsInput), directory]),
      );
      setLocalSkillsDirsInput(nextDirectories.join("\n"));
      message.success("目录已加入列表，点击“保存本地目录”后生效");
    } catch (error) {
      message.error(`选择本地 Skills 目录失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const selfChecks = selfCheckResult?.items ?? [];

  const refreshDashboardUrl = async () => {
    setLoading(true);
    try {
      const result = await getOpenClawDashboardUrl();
      setDashboardUrl(result.url);
      message.success("已获取 Dashboard URL");
    } catch (error) {
      message.error(`获取 Dashboard URL 失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const openDashboard = async () => {
    setLoading(true);
    try {
      const result = await openOpenClawDashboard();
      setDashboardUrl(result.url);
      message.success("已在浏览器打开 Control UI");
    } catch (error) {
      message.error(`打开 Control UI 失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const copyDashboardUrl = async () => {
    if (!dashboardUrl) {
      message.warning("请先获取 Dashboard URL");
      return;
    }

    try {
      await navigator.clipboard.writeText(dashboardUrl);
      message.success("Dashboard URL 已复制");
    } catch (error) {
      message.error(`复制失败: ${String(error)}`);
    }
  };

  const saveAuth = async () => {
    setLoading(true);
    try {
      const values = await authForm.validateFields();
      const saved = await saveOpenClawAuthConfig(values);
      setAuthConfig(saved);
      authForm.setFieldsValue({
        provider: saved.provider,
        model: saved.model,
        apiKey: "",
        apiBaseUrl: saved.apiBaseUrl ?? "",
      });
      form.setFieldValue("model", saved.model);
      message.success("模型与授权已保存到内置 OpenClaw");
    } catch (error) {
      message.error(`保存授权配置失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex vertical gap={20}>
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
              <Button type="primary" loading={loading} onClick={() => void installBundledRuntime()}>
                安装或修复运行环境
              </Button>
              <Button loading={loading} onClick={() => void launchRuntime()}>
                启动运行环境
              </Button>
              <Button loading={loading} onClick={() => void runProbe()}>
                重新检查
              </Button>
              <Button loading={loading} onClick={() => void upgradeBundledRuntime()}>
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
                    <strong>
                      {runtimeReady ? "已就绪" : runtimeInstalled ? "待启动" : "未安装"}
                    </strong>
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

      {windowsHost ? (
        <Alert
          type="info"
          showIcon
          title="Windows 运行建议"
          description="Kadaclaw 现在支持 Windows 下安装内置 OpenClaw，但如果你遇到 PowerShell 安装失败、命令找不到或 runtime 无法启动，优先考虑使用 WSL2 方案。"
        />
      ) : null}

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
            onChange={(event) => setLocalSkillsDirsInput(event.target.value)}
            placeholder={
              windowsHost
                ? "例如：\nC:\\Users\\你的用户名\\openclaw-skills\nD:\\workspace\\my-skills"
                : "例如：\n/Users/your-name/openclaw-skills\n/Users/your-name/workspace/my-skills"
            }
          />
          <Flex gap={8} wrap>
            <Button loading={loading} onClick={() => void appendLocalSkillsDirectory()}>
              选择目录并追加
            </Button>
            <Button
              type="primary"
              loading={loading}
              onClick={() => void saveLocalSkillsDirectories()}
            >
              保存本地目录
            </Button>
            <Button
              loading={loading}
              onClick={() => setLocalSkillsDirsInput(runtimeInfo?.localSkillsDirs.join("\n") ?? "")}
            >
              恢复当前配置
            </Button>
          </Flex>
        </Flex>
      </Card>

      <Card title="模型与授权">
        <Flex vertical gap={16}>
          <Alert
            type={authConfig?.apiKeyConfigured ? "success" : "warning"}
            showIcon
            message={
              authConfig?.apiKeyConfigured
                ? "当前 Provider 已配置授权"
                : "当前 Provider 尚未配置授权"
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
                  shouldUpdate={(prevValues, nextValues) =>
                    prevValues.provider !== nextValues.provider
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue("provider") === "custom" ? (
                      <Form.Item
                        label="API Base URL"
                        name="apiBaseUrl"
                        rules={[
                          { required: true, message: "请输入 Custom Provider 的 API Base URL" },
                        ]}
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
              <Button type="primary" loading={loading} onClick={() => void saveAuth()}>
                保存模型与授权
              </Button>
            </Flex>
          </Form>

          <Descriptions column={1} size="small">
            <Descriptions.Item label="当前 Provider">
              {authConfig?.provider ?? "--"}
            </Descriptions.Item>
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
                      <Form.Item
                        label="健康检查路径"
                        name="healthPath"
                        rules={[{ required: true }]}
                      >
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
                    <Button type="primary" loading={loading} onClick={() => void saveConfig()}>
                      保存并检测
                    </Button>
                    <Button loading={loading} onClick={() => void runProbe()}>
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
                      Control UI 的授权依赖 gateway token，不是模型 API key。如果你看到
                      `unauthorized: gateway token missing`，通常说明还没有从 Dashboard URL 获取
                      token。
                    </Paragraph>

                    <Input
                      readOnly
                      value={dashboardUrl}
                      placeholder="先点击“获取 Dashboard URL”或“打开 Control UI”"
                    />

                    <Flex gap={8} wrap>
                      <Button type="primary" loading={loading} onClick={() => void openDashboard()}>
                        打开 Control UI
                      </Button>
                      <Button loading={loading} onClick={() => void refreshDashboardUrl()}>
                        获取 Dashboard URL
                      </Button>
                      <Button disabled={!dashboardUrl} onClick={() => void copyDashboardUrl()}>
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
                      <Button size="small" loading={loading} onClick={() => void runProbe()}>
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
                          <Descriptions.Item label="消息">
                            {runtimeStatus.message}
                          </Descriptions.Item>
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
    </Flex>
  );
}

import { Alert, Badge, Button, Card, Col, Descriptions, Form, Input, message, Row, Select, Space, Statistic, Switch, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import type { TableColumnsType } from "antd";
import { marketSources } from "../data/mock";
import {
  getOpenClawAuthConfig,
  getOpenClawConfig,
  getOpenClawRuntimeInfo,
  installBundledOpenClawRuntime,
  launchOpenClawRuntime,
  probeOpenClawRuntime,
  saveOpenClawAuthConfig,
  saveOpenClawConfig,
  type OpenClawAuthConfig,
  type OpenClawConfig,
  type OpenClawStatus,
  type RuntimeInfoResult,
  upgradeBundledOpenClawRuntime,
} from "../lib/openclaw";
import { useAppStore } from "../store/appStore";

const { Paragraph, Text, Title } = Typography;

export interface OpenClawFormValues extends Omit<OpenClawConfig, "args"> {
  args: string;
}

interface OpenClawAuthFormValues {
  provider: string;
  model: string;
  apiKey: string;
}

const providerOptions = [
  { label: "Anthropic", value: "anthropic", env: "ANTHROPIC_API_KEY", model: "anthropic/claude-opus-4-6" },
  { label: "OpenAI", value: "openai", env: "OPENAI_API_KEY", model: "openai/gpt-5.2" },
  { label: "OpenRouter", value: "openrouter", env: "OPENROUTER_API_KEY", model: "openrouter/openai/gpt-5.2" },
  { label: "DeepSeek", value: "deepseek", env: "DEEPSEEK_API_KEY", model: "deepseek/deepseek-chat" },
  { label: "Google", value: "google", env: "GEMINI_API_KEY", model: "google/gemini-2.5-pro" },
];

export function SettingsPage() {
  const [form] = Form.useForm<OpenClawFormValues>();
  const [authForm] = Form.useForm<OpenClawAuthFormValues>();
  const [runtimeStatus, setRuntimeStatus] = useState<OpenClawStatus | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfoResult | null>(null);
  const [authConfig, setAuthConfig] = useState<OpenClawAuthConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const setRuntimeState = useAppStore((state) => state.setRuntimeState);

  const refreshRuntimeInfo = async () => {
    try {
      const info = await getOpenClawRuntimeInfo();
      setRuntimeInfo(info);
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
        const auth = await getOpenClawAuthConfig();
        setAuthConfig(auth);
        authForm.setFieldsValue({
          provider: auth.provider,
          model: auth.model,
          apiKey: "",
        });
      } catch (error) {
        message.error(`读取授权配置失败: ${String(error)}`);
      }
    })();
  }, [authForm, form]);

  const runProbe = async () => {
    setLoading(true);
    setRuntimeState("checking", "正在检测 OpenClaw runtime");
    try {
      const status = await probeOpenClawRuntime();
      setRuntimeStatus(status);
      setRuntimeState(status.reachable ? "ready" : "error", status.message);
      message.success("OpenClaw runtime 检测已完成");
    } catch (error) {
      const text = `检测失败: ${String(error)}`;
      setRuntimeState("error", text);
      message.error(text);
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
      await refreshRuntimeInfo();
      await runProbe();
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
      await refreshRuntimeInfo();
      setRuntimeStatus(result.status);
      setRuntimeState("checking", result.status.message);
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
      await refreshRuntimeInfo();
      setRuntimeStatus(result.status);
      setRuntimeState("checking", "内置 OpenClaw 已升级，请重新启动 runtime");
      message.success("内置 OpenClaw 已升级");
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
      message.success("已发起 OpenClaw runtime 启动");
    } catch (error) {
      message.error(`启动失败: ${String(error)}`);
      setRuntimeState("error", `启动失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const marketColumns: TableColumnsType<(typeof marketSources)[number]> = [
    { title: "市场源", dataIndex: "name", key: "name" },
    { title: "范围", dataIndex: "scope", key: "scope" },
    { title: "最近同步", dataIndex: "sync", key: "sync" },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (value: string) => (
        <Badge status={value === "在线" ? "success" : "error"} text={value} />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card className="hero-card settings-hero">
        <div className="settings-hero-grid">
          <div>
            <Tag color="green" className="hero-tag">
              Runtime Hub
            </Tag>
            <Title level={1} className="workspace-title">
              内置 OpenClaw 管理中心
            </Title>
            <Paragraph className="hero-copy">
              安装、升级、探测和高级配置都集中在这里。目标不是暴露更多复杂度，而是把 OpenClaw 的运行时管理真正收进 Kadaclaw 客户端。
            </Paragraph>
            <Space wrap style={{ marginBottom: 8 }}>
              <Button type="primary" loading={loading} onClick={() => void installBundledRuntime()}>
                一键安装内置 OpenClaw
              </Button>
              <Button loading={loading} onClick={() => void upgradeBundledRuntime()}>
                升级内置 OpenClaw
              </Button>
              <Button loading={loading} onClick={() => void launchRuntime()}>
                启动已安装 Runtime
              </Button>
              <Button loading={loading} onClick={() => void runProbe()}>
                检测当前 Runtime
              </Button>
            </Space>
          </div>
          <div>
            <Card className="spotlight-panel runtime-panel">
              <Text type="secondary">Runtime 摘要</Text>
              <Title level={3}>当前环境</Title>
              <div className="runtime-meta-grid">
                <div>
                  <Text type="secondary">安装状态</Text>
                  <strong>{runtimeInfo?.installed ? "已安装" : "未安装"}</strong>
                </div>
                <div>
                  <Text type="secondary">版本</Text>
                  <strong>{runtimeInfo?.version ?? "--"}</strong>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="Runtime 安装" value={runtimeInfo?.installed ? "已安装" : "未安装"} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="内置模式" value={runtimeInfo?.bundled ? "已托管" : "外部模式"} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="技能目录" value={runtimeInfo?.skillsDir ? "已就位" : "未准备"} />
          </Card>
        </Col>
      </Row>

      <Card className="panel-card" title="OpenClaw Runtime 配置">
        <Paragraph type="secondary">
          默认情况下 Kadaclaw 会托管内置 runtime。这里保留高级入口，方便你覆盖默认端口、模型和启动参数。
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
                <Input placeholder="http://127.0.0.1:18789" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="健康检查路径" name="healthPath" rules={[{ required: true }]}>
                <Input placeholder="/" />
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
                <Input placeholder="gateway run --allow-unconfigured --auth none --port 18789 --force" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="工作目录" name="workingDirectory">
                <Input placeholder="/path/to/openclaw" />
              </Form.Item>
            </Col>
          </Row>
          <Space wrap>
            <Button type="primary" loading={loading} onClick={() => void saveConfig()}>
              保存并检测
            </Button>
            <Button loading={loading} onClick={() => void runProbe()}>
              只检测
            </Button>
          </Space>
        </Form>
      </Card>

      <Card className="panel-card" title="模型与授权">
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Alert
            type={authConfig?.apiKeyConfigured ? "success" : "warning"}
            showIcon
            message={authConfig?.apiKeyConfigured ? "当前 Provider 已配置授权" : "当前 Provider 尚未配置授权"}
            description={
              authConfig
                ? `当前模型为 ${authConfig.model}，OpenClaw 会读取 ${authConfig.apiKeyEnvName}。`
                : "为 OpenClaw 选择模型提供方并写入对应 API key。"
            }
          />

          <Form form={authForm} layout="vertical">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={8}>
                <Form.Item label="Provider" name="provider" rules={[{ required: true }]}>
                  <Select
                    options={providerOptions.map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) => {
                      const next = providerOptions.find((item) => item.value === value);
                      if (!next) {
                        return;
                      }
                      authForm.setFieldsValue({
                        model: next.model,
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
                <Form.Item label="API Key" name="apiKey">
                  <Input.Password placeholder="输入新的 API key，留空则保留当前已保存的 key" />
                </Form.Item>
              </Col>
            </Row>
            <Space wrap>
              <Button
                type="primary"
                loading={loading}
                onClick={() =>
                  void (async () => {
                    setLoading(true);
                    try {
                      const values = await authForm.validateFields();
                      const saved = await saveOpenClawAuthConfig(values);
                      setAuthConfig(saved);
                      authForm.setFieldsValue({
                        provider: saved.provider,
                        model: saved.model,
                        apiKey: "",
                      });
                      form.setFieldValue("model", saved.model);
                      message.success("模型与授权已保存到内置 OpenClaw");
                    } catch (error) {
                      message.error(`保存授权配置失败: ${String(error)}`);
                    } finally {
                      setLoading(false);
                    }
                  })()
                }
              >
                保存模型与授权
              </Button>
            </Space>
          </Form>

          <Descriptions column={1} size="small">
            <Descriptions.Item label="当前 Provider">{authConfig?.provider ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="当前模型">{authConfig?.model ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="读取环境变量">{authConfig?.apiKeyEnvName ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="授权状态">
              {authConfig?.apiKeyConfigured ? "已配置" : "未配置"}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {runtimeStatus ? (
          <Col xs={24} xl={12}>
            <Card className="panel-card" title="OpenClaw 检测结果">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Endpoint">{runtimeStatus.endpoint}</Descriptions.Item>
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
            <Card className="panel-card" title="OpenClaw Runtime 信息">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="版本">{runtimeInfo.version}</Descriptions.Item>
                <Descriptions.Item label="命令路径">{runtimeInfo.commandPath}</Descriptions.Item>
                <Descriptions.Item label="安装目录">{runtimeInfo.installDir}</Descriptions.Item>
                <Descriptions.Item label="技能目录">{runtimeInfo.skillsDir}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        ) : null}
      </Row>

      <Card className="panel-card" title="技能市场源">
        <Table rowKey="id" columns={marketColumns} dataSource={marketSources} pagination={false} />
      </Card>

      <Card className="panel-card" title="产品接入说明">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="OpenClaw 接入">
            通过桌面端 Provider 层适配对话、技能执行和工具调用。
          </Descriptions.Item>
          <Descriptions.Item label="技能目录打通">
            Kadaclaw 已经为内置 OpenClaw 固定私有 skills 目录，下一步可以把市场安装直接写入这里。
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}

import {
  Alert,
  Badge,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Steps,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { saveOpenClawAuthConfig, type SaveOpenClawAuthPayload } from "~/api";
import { OPENCLAW_PROVIDER_OPTIONS } from "~/common/constants";
import { getRuntimeBadgeStatus } from "~/common/runtime";
import { useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

function isWindowsHost() {
  return typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);
}

interface OnboardingModalProps {
  open: boolean;
  runtimeReachable: boolean;
  authConfigured: boolean;
  installDir?: string | null;
  loading: boolean;
  onInstall: () => void;
  onStart: () => void;
  onAdvanced: () => void;
  onFinish: () => void;
  onSkip: () => void;
  onOpenWorkspace: () => void;
}

export function OnboardingModal({
  open,
  runtimeReachable,
  authConfigured,
  installDir,
  loading,
  onInstall,
  onStart,
  onAdvanced,
  onFinish,
  onSkip,
  onOpenWorkspace,
}: OnboardingModalProps) {
  const [authForm] = Form.useForm<SaveOpenClawAuthPayload>();
  const [authSaving, setAuthSaving] = useState(false);
  const windowsHost = isWindowsHost();
  const runtimeMessage = useRuntimeStore((state) => state.runtimeMessage);
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const authConfig = useRuntimeStore((state) => state.authConfig);
  const refreshAuthConfig = useRuntimeStore((state) => state.refreshAuthConfig);

  const currentStep = useMemo(() => {
    if (!runtimeReachable) {
      return 0;
    }

    if (!authConfigured) {
      return 1;
    }

    return 2;
  }, [authConfigured, runtimeReachable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultProvider =
      authConfig?.provider ?? OPENCLAW_PROVIDER_OPTIONS[0]?.value ?? "anthropic";
    const providerOption =
      OPENCLAW_PROVIDER_OPTIONS.find((item) => item.value === defaultProvider) ??
      OPENCLAW_PROVIDER_OPTIONS[0];

    authForm.setFieldsValue({
      provider: defaultProvider,
      model: authConfig?.model ?? providerOption?.model ?? "anthropic/claude-opus-4-6",
      apiKey: "",
      apiBaseUrl: authConfig?.apiBaseUrl ?? "",
    });
  }, [authConfig, authForm, open]);

  const saveAuthConfig = async () => {
    setAuthSaving(true);
    try {
      const values = await authForm.validateFields();
      await saveOpenClawAuthConfig(values);
      await refreshAuthConfig();
      authForm.setFieldValue("apiKey", "");
      message.success("模型与授权已保存");
    } finally {
      setAuthSaving(false);
    }
  };

  const stepItems = [
    {
      title: "准备运行环境",
      description: runtimeReachable ? "已就绪" : "需要安装或启动",
    },
    {
      title: "配置模型授权",
      description: authConfigured ? "已完成" : "需要填写 API Key",
    },
    {
      title: "开始使用",
      description: runtimeReachable && authConfigured ? "可以开始聊天" : "等待前两步完成",
    },
  ];

  return (
    <Modal open={open} closable={false} footer={null} width={820} title="首次启动引导">
      <Flex vertical gap={20}>
        <Paragraph style={{ marginBottom: 0 }}>
          先把运行环境和模型授权准备好，再开始正式使用
          Kadaclaw。整个过程只保留你真正需要完成的步骤。
        </Paragraph>

        <Steps current={currentStep} items={stepItems} className={styles.steps} />

        {currentStep === 0 ? (
          <Flex vertical gap={16}>
            <Card className={styles.innerCard}>
              <Flex vertical gap={10}>
                <Badge status={getRuntimeBadgeStatus(runtimeStatus)} text={runtimeMessage} />
                <Text type="secondary">
                  安装目标目录：
                  <Text code>{installDir ?? "<应用本地数据目录>/openclaw-runtime"}</Text>
                </Text>
              </Flex>
            </Card>
            <Alert
              type="info"
              showIcon
              message="Kadaclaw 会优先使用内置运行环境"
              description="如果当前机器还没有可用的 OpenClaw 运行环境，直接安装内置版本即可。只有在你已经安装过并确认可用时，才建议选择“仅启动已安装 Runtime”。"
            />
            {windowsHost ? (
              <Alert
                type="info"
                showIcon
                message="Windows 兼容提示"
                description="当前已支持 Windows 安装，但如果原生环境下出现安装或启动异常，优先考虑在 WSL2 中安装和运行 OpenClaw。"
              />
            ) : null}
            <Flex gap={8} wrap>
              <Button type="primary" size="large" loading={loading} onClick={onInstall}>
                一键安装并启动
              </Button>
              <Button size="large" loading={loading} onClick={onStart}>
                仅启动已安装 Runtime
              </Button>
              <Button size="large" onClick={onAdvanced}>
                高级配置
              </Button>
            </Flex>
          </Flex>
        ) : null}

        {currentStep === 1 ? (
          <Flex vertical gap={16}>
            <Alert
              type="success"
              showIcon
              message="运行环境已经就绪"
              description="下一步只需要选择模型提供方并保存 API Key。保存后就可以直接进入聊天工作台。"
            />
            <Card>
              <Title level={4} className={styles.sectionTitle}>
                模型与授权
              </Title>
              <Form form={authForm} layout="vertical">
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
                <Form.Item label="模型" name="model" rules={[{ required: true }]}>
                  <Input placeholder="openai/gpt-5.2" />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(previousValues, nextValues) =>
                    previousValues.provider !== nextValues.provider
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue("provider") === "custom" ? (
                      <Form.Item
                        label="API Base URL"
                        name="apiBaseUrl"
                        rules={[
                          {
                            required: true,
                            message: "请输入 Custom Provider 的 API Base URL",
                          },
                        ]}
                      >
                        <Input placeholder="https://example.com/v1" />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
                <Form.Item
                  label="API Key"
                  name="apiKey"
                  rules={[{ required: true, message: "请输入 API Key" }]}
                >
                  <Input.Password placeholder="输入用于当前 Provider 的 API Key" />
                </Form.Item>
              </Form>
            </Card>
            <Flex gap={8} wrap>
              <Button
                type="primary"
                size="large"
                loading={authSaving}
                onClick={() => void saveAuthConfig()}
              >
                保存授权并继续
              </Button>
              <Button size="large" disabled={authSaving} onClick={onAdvanced}>
                去设置页查看更多选项
              </Button>
            </Flex>
          </Flex>
        ) : null}

        {currentStep === 2 ? (
          <Flex vertical gap={16}>
            <Alert
              type="success"
              showIcon
              message="准备完成"
              description="运行环境和模型授权都已经配置好。接下来你可以直接进入聊天工作台，也可以先去技能中心看看当前已识别的能力。"
            />
            <Card>
              <Flex vertical gap={10}>
                <Title level={4} className={styles.sectionTitle}>
                  你现在可以做什么
                </Title>
                <Text>1. 在聊天工作台里直接提问，让系统按当前模型开始响应。</Text>
                <Text>2. 在技能中心查看已识别的能力，并启用或关闭官方技能。</Text>
                <Text>3. 遇到问题时，再去设置页查看运行环境和模型配置。</Text>
              </Flex>
            </Card>
            <Flex gap={8} wrap>
              <Button type="primary" size="large" onClick={onOpenWorkspace}>
                进入聊天工作台
              </Button>
              <Button size="large" onClick={onFinish}>
                稍后再看，先进入应用
              </Button>
            </Flex>
          </Flex>
        ) : null}

        {currentStep < 2 ? (
          <Flex justify="space-between" align="center" gap={12} className={styles.footerRow}>
            <Text type="secondary">当前引导只影响首次使用，不会改变你后续的高级配置能力。</Text>
            <Button onClick={onSkip}>本次先跳过</Button>
          </Flex>
        ) : null}
      </Flex>
    </Modal>
  );
}

import { Alert, Flex, Form, message } from "antd";
import { useEffect, useState } from "react";
import {
  type OpenClawConfig,
  getOpenClawAuthConfig,
  getOpenClawConfig,
  getOpenClawDashboardUrl,
  getOpenClawLocalSkillsDirs,
  installBundledOpenClawRuntime,
  launchOpenClawRuntime,
  openOpenClawDashboard,
  pickOpenClawLocalSkillsDir,
  type OpenClawAuthConfig,
  type OpenClawSelfCheckResult,
  type OpenClawStatus,
  type RuntimeInfoResult,
  runOpenClawSelfCheck,
  saveOpenClawAuthConfig,
  saveOpenClawConfig,
  saveOpenClawLocalSkillsDirs,
  upgradeBundledOpenClawRuntime,
} from "~/api";
import { useRuntimeStore, useSkillStore } from "~/store";
import {
  isWindowsHost,
  parseLocalSkillsDirsInput,
  type OpenClawAuthFormValues,
  type OpenClawFormValues,
} from "./helpers";
import {
  AdvancedPanelsSection,
  LocalSkillsSection,
  ModelAuthSection,
  ReadinessSection,
  SettingsHeroSection,
} from "./sections";

export const SettingsPage = () => {
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

  const selfChecks = selfCheckResult?.items ?? [];

  return (
    <Flex vertical gap={20}>
      <SettingsHeroSection
        authReady={authReady}
        loading={loading}
        runtimeInstalled={runtimeInstalled}
        runtimeReady={runtimeReady}
        onInstallBundledRuntime={() => void installBundledRuntime()}
        onLaunchRuntime={() => void launchRuntime()}
        onRunProbe={() => void runProbe()}
        onUpgradeBundledRuntime={() => void upgradeBundledRuntime()}
      />

      {windowsHost ? (
        <Alert
          type="info"
          showIcon
          title="Windows 运行建议"
          description="Kadaclaw 现在支持 Windows 下安装内置 OpenClaw，但如果你遇到 PowerShell 安装失败、命令找不到或 runtime 无法启动，优先考虑使用 WSL2 方案。"
        />
      ) : null}

      <ReadinessSection
        authConfig={authConfig}
        authReady={authReady}
        runtimeInstalled={runtimeInstalled}
        runtimeReady={runtimeReady}
      />

      <LocalSkillsSection
        loading={loading}
        localSkillsDirsInput={localSkillsDirsInput}
        runtimeInfo={runtimeInfo}
        windowsHost={windowsHost}
        onAppendLocalSkillsDirectory={() => void appendLocalSkillsDirectory()}
        onInputChange={setLocalSkillsDirsInput}
        onRestoreCurrentConfig={() =>
          setLocalSkillsDirsInput(runtimeInfo?.localSkillsDirs.join("\n") ?? "")
        }
        onSaveLocalSkillsDirectories={() => void saveLocalSkillsDirectories()}
      />

      <ModelAuthSection
        authConfig={authConfig}
        authForm={authForm}
        loading={loading}
        onSaveAuth={() => void saveAuth()}
      />

      <AdvancedPanelsSection
        dashboardUrl={dashboardUrl}
        form={form}
        loading={loading}
        runtimeInfo={runtimeInfo}
        runtimeStatus={runtimeStatus}
        selfCheckResult={selfCheckResult}
        selfChecks={selfChecks}
        onCopyDashboardUrl={() => void copyDashboardUrl()}
        onOpenDashboard={() => void openDashboard()}
        onRefreshDashboardUrl={() => void refreshDashboardUrl()}
        onRunProbe={() => void runProbe()}
        onSaveConfig={() => void saveConfig()}
      />
    </Flex>
  );
};

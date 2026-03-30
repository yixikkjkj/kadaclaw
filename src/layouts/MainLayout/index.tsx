import { Layout } from "antd";
import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import {
  ensureOpenClawRuntime,
  getOpenClawRuntimeInfo,
  installBundledOpenClawRuntime,
  launchOpenClawRuntime,
} from "~/api";
import { ROUTE_PATHS } from "~/common/constants";
import { getErrorMessage } from "~/common/utils";
import { Sidebar, BootstrappingScreen, OnboardingModal, SkillDetailDrawer } from "~/components";
import styles from "./index.css";
import { useRuntimeStore, useSkillStore } from "~/store";

const { Content } = Layout;

export default function MainLayout() {
  const runtimeMessage = useRuntimeStore((state) => state.runtimeMessage);
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const setRuntimeState = useRuntimeStore((state) => state.setRuntimeState);
  const refreshInstalledSkills = useSkillStore((state) => state.refreshInstalledSkills);
  const navigate = useNavigate();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [runtimeInstallDir, setRuntimeInstallDir] = useState<string | null>(null);
  const bootstrapStartedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);

  const refreshRuntimeInfo = async () => {
    try {
      const runtimeInfo = await getOpenClawRuntimeInfo();
      setRuntimeInstallDir(runtimeInfo.installDir);
    } catch {
      setRuntimeInstallDir(null);
    }
  };

  const syncSkills = async (runtimeReachable: boolean, statusMessage: string) => {
    try {
      await refreshInstalledSkills();
    } catch (reason) {
      if (runtimeReachable) {
        setRuntimeState(
          "ready",
          `${statusMessage}，但技能状态同步失败：${getErrorMessage(reason, "未知错误")}`,
        );
      }
    }
  };

  const refreshRuntime = async () => {
    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
      return null;
    }

    const task = (async () => {
      try {
        void refreshRuntimeInfo();
        setRuntimeState("checking", "正在初始化 OpenClaw runtime");
        const status = await ensureOpenClawRuntime();
        setRuntimeState(status.reachable ? "ready" : "error", status.message);
        setShowOnboarding(!status.reachable);
        setBootstrapping(false);
        void syncSkills(status.reachable, status.message);

        return status;
      } catch (reason) {
        setRuntimeState(
          "error",
          getErrorMessage(reason, "尚未检测到 OpenClaw runtime，请完成首次安装"),
        );
        setShowOnboarding(true);
        setBootstrapping(false);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = task;
    return await task;
  };

  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }
    bootstrapStartedRef.current = true;
    void refreshRuntimeInfo();
    void refreshRuntime();
  }, [refreshInstalledSkills, setRuntimeState]);

  const runOnboardingInstall = async () => {
    if (onboardingLoading) {
      return;
    }
    setOnboardingLoading(true);
    setRuntimeState("checking", "正在安装内置 OpenClaw runtime");
    try {
      await installBundledOpenClawRuntime();
      setRuntimeState("checking", "OpenClaw 已安装，正在启动 runtime");
      await launchOpenClawRuntime();
      await refreshRuntime();
    } catch (reason) {
      setRuntimeState(
        "error",
        `安装或启动失败：${getErrorMessage(reason, "未知错误")}`,
      );
      setShowOnboarding(true);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const runOnboardingStart = async () => {
    if (onboardingLoading) {
      return;
    }
    setOnboardingLoading(true);
    setRuntimeState("checking", "正在启动 OpenClaw runtime");
    try {
      await launchOpenClawRuntime();
      await refreshRuntime();
    } catch (reason) {
      setRuntimeState(
        "error",
        `启动失败：${getErrorMessage(reason, "未知错误")}`,
      );
      setShowOnboarding(true);
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <>
      <OnboardingModal
        open={showOnboarding}
        runtimeStatus={runtimeStatus}
        runtimeMessage={runtimeMessage}
        installDir={runtimeInstallDir}
        loading={onboardingLoading}
        onInstall={() => void runOnboardingInstall()}
        onStart={() => void runOnboardingStart()}
        onAdvanced={() => navigate(ROUTE_PATHS.settings)}
      />

      <Layout className={styles.appShell}>
        <Sidebar />
        <Layout>
          <Content className={styles.appContent}>
            {bootstrapping ? (
              <BootstrappingScreen
                runtimeMessage={runtimeMessage}
                runtimeStatus={runtimeStatus}
              />
            ) : (
              <Outlet />
            )}
          </Content>
        </Layout>
      </Layout>

      <SkillDetailDrawer />
    </>
  );
}

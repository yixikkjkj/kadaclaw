import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { RouterProvider } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { router } from "~/common/router";
import { BootstrappingScreen, OnboardingModal } from "~/components";
import { getErrorMessage } from "~/common/utils";
import {
  ensureOpenClawRuntime,
  getOpenClawActiveStream,
  getOpenClawRuntimeInfo,
  installBundledOpenClawRuntime,
  launchOpenClawRuntime,
} from "~/api";
import { useChatStore, useRuntimeStore, useSkillStore } from "~/store";

export const AppRoot = () => {
  const setRuntimeState = useRuntimeStore((state) => state.setRuntimeState);
  const refreshInstalledSkills = useSkillStore((state) => state.refreshInstalledSkills);
  const hydrateChatHistory = useChatStore((state) => state.hydrateChatHistory);
  const hydrateActiveStream = useChatStore((state) => state.hydrateActiveStream);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const updateStreamingReply = useChatStore((state) => state.updateStreamingReply);
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
        setRuntimeState("checking", "正在初始化");
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
    void hydrateChatHistory();
  }, [hydrateChatHistory]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    void hydrateActiveStream();

    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<{ sessionId: string; content: string }>("openclaw://chat-stream", (event) => {
      updateStreamingReply(event.payload.sessionId, event.payload.content);
    })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch((reason) => {
        console.error("订阅 OpenClaw 流式事件失败", reason);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [hydrateActiveStream, updateStreamingReply]);

  useEffect(() => {
    if (!isTauri() || !streamingRunning) {
      return;
    }

    let disposed = false;
    const timer = window.setInterval(() => {
      void getOpenClawActiveStream()
        .then((snapshot) => {
          if (disposed || !snapshot) {
            return;
          }

          updateStreamingReply(snapshot.sessionId, snapshot.content);
        })
        .catch((reason) => {
          if (!disposed) {
            console.error("轮询 OpenClaw 流式状态失败", reason);
          }
        });
    }, 120);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [streamingRunning, updateStreamingReply]);

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
      setRuntimeState("error", `安装或启动失败：${getErrorMessage(reason, "未知错误")}`);
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
      setRuntimeState("error", `启动失败：${getErrorMessage(reason, "未知错误")}`);
      setShowOnboarding(true);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const shouldRenderRouter = !bootstrapping || showOnboarding;

  return (
    <>
      {shouldRenderRouter ? <RouterProvider router={router} /> : null}
      {bootstrapping ? <BootstrappingScreen /> : null}
      <OnboardingModal
        open={showOnboarding}
        installDir={runtimeInstallDir}
        loading={onboardingLoading}
        onInstall={runOnboardingInstall}
        onStart={runOnboardingStart}
        onAdvanced={() => void router.navigate(ROUTE_PATHS.settings)}
      />
    </>
  );
};

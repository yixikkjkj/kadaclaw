import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, createHashRouter, useRouteError } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { RouteStatusCard } from "~/components";
import { getErrorMessage } from "~/common/utils";
import MainLayout from "~/layouts/MainLayout";

const WorkspacePage = lazy(async () =>
  import("~/pages/Workspace").then((module) => ({ default: module.WorkspacePage })),
);
const MarketPage = lazy(async () =>
  import("~/pages/Market").then((module) => ({ default: module.MarketPage })),
);
const InstalledPage = lazy(async () =>
  import("~/pages/Installed").then((module) => ({ default: module.InstalledPage })),
);
const SettingsPage = lazy(async () =>
  import("~/pages/Settings").then((module) => ({ default: module.SettingsPage })),
);

function RouteErrorElement() {
  const error = useRouteError();

  return (
    <RouteStatusCard
      mode="error"
      title="当前页面加载失败"
      message={getErrorMessage(error, "页面模块加载失败，请刷新后重试")}
    />
  );
}

function withRouteFallback(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <RouteStatusCard
          mode="loading"
          title="正在加载当前页面"
          message="页面资源正在初始化，如果长时间没有进入页面，可以直接刷新。"
        />
      }
    >
      {element}
    </Suspense>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to={ROUTE_PATHS.market} replace />,
      },
      {
        path: ROUTE_PATHS.workspace.slice(1),
        element: withRouteFallback(<WorkspacePage />),
        errorElement: <RouteErrorElement />,
      },
      {
        path: ROUTE_PATHS.market.slice(1),
        element: withRouteFallback(<MarketPage />),
        errorElement: <RouteErrorElement />,
      },
      {
        path: ROUTE_PATHS.installed.slice(1),
        element: withRouteFallback(<InstalledPage />),
        errorElement: <RouteErrorElement />,
      },
      {
        path: ROUTE_PATHS.settings.slice(1),
        element: withRouteFallback(<SettingsPage />),
        errorElement: <RouteErrorElement />,
      },
      {
        path: "*",
        element: <Navigate to={ROUTE_PATHS.market} replace />,
      },
    ],
  },
]);

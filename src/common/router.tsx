import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, createHashRouter } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { BootstrappingScreen } from "~/components";
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

function withRouteFallback(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <BootstrappingScreen
          runtimeMessage="正在加载当前页面"
          runtimeStatus="checking"
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
      },
      {
        path: ROUTE_PATHS.market.slice(1),
        element: withRouteFallback(<MarketPage />),
      },
      {
        path: ROUTE_PATHS.installed.slice(1),
        element: withRouteFallback(<InstalledPage />),
      },
      {
        path: ROUTE_PATHS.settings.slice(1),
        element: withRouteFallback(<SettingsPage />),
      },
      {
        path: "*",
        element: <Navigate to={ROUTE_PATHS.market} replace />,
      },
    ],
  },
]);

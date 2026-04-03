export type CommercePlatform = "taobao" | "douyin" | "pdd" | "jd";

export type BusinessObjectType = "product" | "order" | "aftersales" | "shop";

export type CommerceTimeRange = "today" | "7d" | "30d";

export type CommerceSceneKey =
  | "listing-copilot"
  | "aftersales-copilot"
  | "store-review-copilot"
  | "order-exception"
  | "review-recovery"
  | "risk-inspector";

export interface PlatformConnectionDraft {
  platform: CommercePlatform;
  shopName: string;
  credential: string;
  updatedAt: number;
}

import fs from "node:fs";

const EXIT_USAGE = 1;

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
};

const buildText = (alerts) => {
  const lines = [`淘宝商品舆情预警，共 ${alerts.length} 条`];
  alerts.slice(0, 10).forEach((alert, index) => {
    if (alert.type === "item_negative_cluster") {
      lines.push(
        `${index + 1}. [${alert.severity}] ${alert.itemTitle || "(untitled item)"}(${alert.itemId || "unknown"}) 24h 内集中负面 ${alert.count} 条`,
      );
      return;
    }

    lines.push(
      `${index + 1}. [${alert.severity}] ${alert.itemTitle || "(untitled item)"} ${alert.source}: ${(alert.content || "").slice(0, 60)}`,
    );
  });
  return lines.join("\n");
};

const buildPayload = (provider, text) => {
  if (provider === "dingtalk") {
    return {
      msgtype: "text",
      text: {
        content: text,
      },
    };
  }

  return {
    msg_type: "text",
    content: {
      text,
    },
  };
};

const postWebhook = async (webhookUrl, provider, text) => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(buildPayload(provider, text)),
  });

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input;
  const webhookUrl = args.webhook || process.env.ALERT_WEBHOOK_URL || "";
  const provider = args.provider || process.env.ALERT_WEBHOOK_PROVIDER || "feishu";

  if (!inputPath) {
    console.error("Usage: node skills/taobao-feedback-monitor/scripts/send-alert.mjs --input <alerts-json> [--webhook <url>]");
    process.exit(EXIT_USAGE);
  }

  const alerts = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const text = buildText(Array.isArray(alerts) ? alerts : []);

  if (!webhookUrl) {
    console.log(
      JSON.stringify(
        {
          sent: false,
          reason: "missing webhook url",
          preview: text,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await postWebhook(webhookUrl, provider, text);
  console.log(
    JSON.stringify(
      {
        sent: result.ok,
        status: result.status,
        provider,
        body: result.body,
      },
      null,
      2,
    ),
  );
};

await main();

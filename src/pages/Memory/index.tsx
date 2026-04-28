import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Spin, Tooltip, Typography } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  ClearOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  type MemoryEntry,
  listMemories,
  updateMemory,
  deleteMemory,
  clearAllMemories,
} from "~/api";
import styles from "./index.css";

const { Text } = Typography;

interface RowProps {
  entry: MemoryEntry;
  onDelete: (id: string) => void;
  onSave: (id: string, content: string) => Promise<void>;
}

const MemoryRow = ({ entry, onDelete, onSave }: RowProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(entry.id, draft);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(entry.content);
    setEditing(false);
  };

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.typeBadge}>{entry.memory_type}</span>
        <span className={styles.rowMeta}>
          {entry.scope} · 重要度 {entry.importance} · 访问 {entry.access_count}{" "}
          · {new Date(entry.created_at).toLocaleDateString()}
        </span>
        {entry.tags && (
          <span className={styles.rowMeta}>标签: {entry.tags}</span>
        )}
      </div>
      {editing ? (
        <>
          <Input.TextArea
            className={styles.editArea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 8 }}
          />
          <div className={styles.rowActions}>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={handleCancel}
            >
              取消
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.content}>{entry.content}</div>
          <div className={styles.rowActions}>
            <Tooltip title="编辑">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => setEditing(true)}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(entry.id)}
              />
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
};

export const MemoryPage = () => {
  const { message, modal } = App.useApp();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const list = await listMemories(q || undefined);
        setEntries(list);
      } catch (e) {
        void message.error("加载记忆失败");
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = () => load(query);

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "确认删除",
      content: "删除后不可恢复，确定继续？",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteMemory(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      },
    });
  };

  const handleSave = async (id: string, content: string) => {
    await updateMemory(id, content);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, content } : e)),
    );
  };

  const handleClearAll = () => {
    modal.confirm({
      title: "清空所有记忆",
      content: "此操作将软删除所有记忆条目，确定继续？",
      okButtonProps: { danger: true },
      onOk: async () => {
        await clearAllMemories();
        setEntries([]);
        void message.success("已清空所有记忆");
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text className={styles.title}>长期记忆</Text>
        <Button
          icon={<ClearOutlined />}
          danger
          size="small"
          onClick={handleClearAll}
          disabled={entries.length === 0}
        >
          清空
        </Button>
      </div>
      <div className={styles.toolbar}>
        <Input
          className={styles.searchInput}
          placeholder="搜索记忆内容..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={handleSearch}
          prefix={<SearchOutlined />}
          allowClear
          onClear={() => load()}
        />
        <Button icon={<SearchOutlined />} onClick={handleSearch}>
          搜索
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => load()}>
          刷新
        </Button>
      </div>
      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>
            <Spin />
          </div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>
            <Text type="secondary">暂无记忆条目</Text>
          </div>
        ) : (
          entries.map((entry) => (
            <MemoryRow
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              onSave={handleSave}
            />
          ))
        )}
      </div>
    </div>
  );
};

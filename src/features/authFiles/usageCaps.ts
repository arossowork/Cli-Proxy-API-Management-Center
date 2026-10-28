import { normalizeProviderKey } from '@/features/authFiles/constants';

export const USAGE_CAP_FIELDS = {
  fiveHour: 'usage_cap_5h',
  sevenDay: 'usage_cap_7d',
} as const;

export type UsageCapWindow = keyof typeof USAGE_CAP_FIELDS;
export type UsageCapField = 'usageCap5h' | 'usageCap7d';

export type UsageCapsDraft = {
  fiveHour: string;
  sevenDay: string;
};

export type UsageCapsPatch = {
  usage_cap_5h?: number | null;
  usage_cap_7d?: number | null;
};

export const USAGE_CAP_EDITOR_FIELDS: Record<UsageCapField, UsageCapWindow> = {
  usageCap5h: 'fiveHour',
  usageCap7d: 'sevenDay',
};

/** Usage caps compare against Anthropic subscription windows, so only Claude credentials use them. */
export const supportsAuthFileUsageCaps = (providerKey: string): boolean =>
  normalizeProviderKey(providerKey) === 'claude';

/** Returns a stored cap in (0, 100], or undefined when absent or invalid. */
export const readUsageCap = (value: unknown): number | undefined => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : undefined;
};

export const readUsageCapsDraft = (json: Record<string, unknown>): UsageCapsDraft => {
  const fiveHour = readUsageCap(json[USAGE_CAP_FIELDS.fiveHour]);
  const sevenDay = readUsageCap(json[USAGE_CAP_FIELDS.sevenDay]);
  return {
    fiveHour: fiveHour !== undefined ? String(fiveHour) : '',
    sevenDay: sevenDay !== undefined ? String(sevenDay) : '',
  };
};

/** Empty text clears the cap; anything else must be a number in (0, 100]. */
export const isUsageCapTextValid = (text: string): boolean =>
  !text.trim() || readUsageCap(text) !== undefined;

export const usageCapsDraftError = (draft: UsageCapsDraft | undefined): boolean =>
  Boolean(draft && (!isUsageCapTextValid(draft.fiveHour) || !isUsageCapTextValid(draft.sevenDay)));

export const buildUsageCapsPatch = (
  original: Record<string, unknown>,
  draft: UsageCapsDraft | undefined
): UsageCapsPatch => {
  const patch: UsageCapsPatch = {};
  if (!draft) return patch;
  (Object.keys(USAGE_CAP_FIELDS) as UsageCapWindow[]).forEach((window) => {
    const field = USAGE_CAP_FIELDS[window];
    const text = draft[window];
    if (!isUsageCapTextValid(text)) return;
    const next = text.trim() ? readUsageCap(text) : undefined;
    const current = readUsageCap(original[field]);
    if (next === current && (next !== undefined || original[field] === undefined)) return;
    patch[field] = next ?? null;
  });
  return patch;
};

export const applyUsageCapsPatch = (value: Record<string, unknown>, patch: UsageCapsPatch) => {
  (Object.values(USAGE_CAP_FIELDS) as Array<keyof UsageCapsPatch>).forEach((field) => {
    const next = patch[field];
    if (next === undefined) return;
    if (next === null) {
      delete value[field];
    } else {
      value[field] = next;
    }
  });
};

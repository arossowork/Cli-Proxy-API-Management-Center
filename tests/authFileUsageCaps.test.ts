import { describe, expect, test } from 'bun:test';
import {
  buildAuthFileFieldsPatch,
  type PrefixProxyEditorState,
} from '../src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { cooldownReasonKey } from '../src/features/authFiles/cooldowns';
import {
  applyUsageCapsPatch,
  buildUsageCapsPatch,
  readUsageCapsDraft,
  supportsAuthFileUsageCaps,
  usageCapsDraftError,
} from '../src/features/authFiles/usageCaps';

const makeEditor = (
  json: Record<string, unknown>,
  providerKey: string,
  usageCaps: { fiveHour: string; sevenDay: string }
): PrefixProxyEditorState => ({
  fileName: 'claude.json',
  fileInfoText: '',
  loading: false,
  saving: false,
  error: null,
  originalText: JSON.stringify(json),
  rawText: JSON.stringify(json),
  invalidContentPreview: '',
  json,
  usageCaps,
  providerKey,
  prefix: '',
  proxyUrl: '',
  priority: '',
  weight: '',
  weightError: null,
  disableCooling: false,
  disableCoolingTouched: false,
  websockets: false,
  websocketsTouched: false,
  useSiwc: false,
  useSiwcTouched: false,
  usingApi: false,
  usingApiTouched: false,
  note: '',
  noteTouched: false,
  excludedModelsText: '',
  excludedModelsTouched: false,
  headersText: '',
  headersTouched: false,
  headersError: null,
});

describe('auth-file usage caps', () => {
  test('are Claude-only', () => {
    expect(supportsAuthFileUsageCaps('claude')).toBe(true);
    expect(supportsAuthFileUsageCaps('codex')).toBe(false);
  });

  test('read stored caps and ignore invalid values', () => {
    expect(readUsageCapsDraft({ usage_cap_5h: 80, usage_cap_7d: '70' })).toEqual({
      fiveHour: '80',
      sevenDay: '70',
    });
    expect(readUsageCapsDraft({ usage_cap_5h: 0, usage_cap_7d: 150 })).toEqual({
      fiveHour: '',
      sevenDay: '',
    });
  });

  test('patch only changed caps and clear emptied ones with null', () => {
    const original = { usage_cap_5h: 80, usage_cap_7d: 70 };
    expect(buildUsageCapsPatch(original, { fiveHour: '80', sevenDay: '70' })).toEqual({});
    expect(buildUsageCapsPatch(original, { fiveHour: '75', sevenDay: '' })).toEqual({
      usage_cap_5h: 75,
      usage_cap_7d: null,
    });
    expect(buildUsageCapsPatch({}, { fiveHour: '', sevenDay: '' })).toEqual({});
    expect(buildUsageCapsPatch({ usage_cap_5h: 'bad' }, { fiveHour: '', sevenDay: '' })).toEqual({
      usage_cap_5h: null,
    });
  });

  test('flag out-of-range input as a blocking error', () => {
    expect(usageCapsDraftError({ fiveHour: '101', sevenDay: '' })).toBe(true);
    expect(usageCapsDraftError({ fiveHour: '0', sevenDay: '' })).toBe(true);
    expect(usageCapsDraftError({ fiveHour: '80', sevenDay: '' })).toBe(false);
  });

  test('apply patch to the preview document', () => {
    const doc: Record<string, unknown> = { usage_cap_7d: 70, email: 'a@b.c' };
    applyUsageCapsPatch(doc, { usage_cap_5h: 80, usage_cap_7d: null });
    expect(doc).toEqual({ usage_cap_5h: 80, email: 'a@b.c' });
  });

  test('are included in the Claude fields patch but not for other providers', () => {
    const caps = { fiveHour: '80', sevenDay: '70' };
    expect(buildAuthFileFieldsPatch(makeEditor({}, 'claude', caps), (key) => key)).toEqual({
      usage_cap_5h: 80,
      usage_cap_7d: 70,
    });
    expect(buildAuthFileFieldsPatch(makeEditor({}, 'codex', caps), (key) => key)).toEqual({});
  });

  test('label usage_cap cooldowns', () => {
    expect(cooldownReasonKey('usage_cap')).toBe('auth_files.cooldown_reason_usage_cap');
  });
});

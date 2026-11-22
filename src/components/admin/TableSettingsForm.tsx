import { KEYPAD_LAYOUTS, SCORER_DUTY_RULES, type TableSettings } from '../../engine/types.ts';
import { Field, Select } from '../ui.tsx';
import { DUTY_RULE_LABEL, KEYPAD_LABEL } from './labels.ts';

/** Who keeps score + default tablet keypad. Used by the setup wizard and the Settings tab. */
export function TableSettingsForm({ value, onPatch }: { value: TableSettings; onPatch: (patch: Partial<TableSettings>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Who keeps score" hint="The team on scorer duty is shown on the stage, the tablet and guest phones. A team never scores its own match.">
        {(id) => (
          <Select id={id} value={value.dutyRule} onChange={(e) => onPatch({ dutyRule: e.target.value as TableSettings['dutyRule'] })}>
            {SCORER_DUTY_RULES.map((r) => (
              <option key={r} value={r}>
                {DUTY_RULE_LABEL[r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Default tablet keypad" hint="Each tablet can still pick its own layout under Keypad.">
        {(id) => (
          <Select id={id} value={value.defaultKeypad} onChange={(e) => onPatch({ defaultKeypad: e.target.value as TableSettings['defaultKeypad'] })}>
            {KEYPAD_LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {KEYPAD_LABEL[l].name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

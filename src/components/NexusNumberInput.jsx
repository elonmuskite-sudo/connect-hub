

const PREFIX = '10'

function getNumericDigits(raw) {
  return String(raw || '').replace(/\D/g, '')
}

function formatSuffixForDisplay(raw) {
  const digits = getNumericDigits(raw)
  const suffix = digits.startsWith(PREFIX) ? digits.slice(PREFIX.length) : digits
  const trimmed = suffix.slice(0, 8)
  const firstGroup = trimmed.slice(0, 4)
  const secondGroup = trimmed.slice(4)
  return secondGroup ? `${firstGroup}-${secondGroup}` : firstGroup
}

export default function NexusNumberInput({ value, onChange, className, placeholder = '2345-6789' }) {
  const suffixValue = formatSuffixForDisplay(value)

  const handleChange = (e) => {
    const rawDigits = getNumericDigits(e.target.value)
    const suffix = rawDigits.startsWith(PREFIX) ? rawDigits.slice(PREFIX.length) : rawDigits
    onChange(`${PREFIX}${suffix.slice(0, 8)}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="select-none text-slate-500">{PREFIX}-</span>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9\\-]*"
        maxLength={9}
        value={suffixValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
    </div>
  )
}

export { formatSuffixForDisplay as formatNexusIdForInput }

import { AVATARS } from '@shared/types'
import styles from './AvatarField.module.css'

interface Props {
  value: string
  onChange: (avatar: string) => void
  labelledBy?: string
}

export function AvatarField({ value, onChange }: Props) {
  return (
    <label className={styles.field}>
      <span className={styles.caption}>Icon</span>
      <span className="visually-hidden">Picture shown next to this student</span>
      <select
        className={styles.select}
        value={value}
        aria-label="Student icon"
        title="Icon shown next to this student"
        onChange={(event) => onChange(event.target.value)}
      >
        {AVATARS.map((avatar) => (
          <option key={avatar} value={avatar}>
            {avatar}
          </option>
        ))}
      </select>
    </label>
  )
}
